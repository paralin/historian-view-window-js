import {
  BehaviorSubject,
} from 'rxjs/BehaviorSubject';
import {
  BoundedStateHistoryMode,
  IBoundedStateHistoryRequest,
  IBoundedStateHistoryResponse,
  IStateContext,
  IStateEntry,
  BoundedStateHistoryStatus,
} from '@fusebot/fusecloud-common';
import {
  ICallHandle,
  IServiceHandle,
} from 'grpc-bus';
import {
  StreamEntry,
} from '@fusebot/state-stream';
import {
  IWindow,
  IWindowData,
  IWindowMeta,
  WindowState,
  StreamingBackend,
  WindowErrors,
} from '@fusebot/remote-state-stream';

// A window is a snapshot of a period of time.
export class HistorianViewWindow implements IWindow {
  public state = new BehaviorSubject<WindowState>(WindowState.Pending);
  public meta = new BehaviorSubject<IWindowMeta>(null);
  public data: IWindowData = new StreamingBackend();

  private callHandle: ICallHandle;
  private isDisposed: boolean = false;
  private shouldActivate = false;
  private midTimestamp: Date;
  private endBoundEntry: StreamEntry;
  private startBoundEntry: StreamEntry;
  private pendingMeta: IWindowMeta = {};

  constructor(private serviceHandle: IServiceHandle,
              private streamContext: IStateContext) {
  }

  public initLive() {
    this.startRequest();
  }

  public initWithMidTimestamp(midTimestamp: Date) {
    this.midTimestamp = midTimestamp;
    this.startRequest();
  }

  public initWithMetadata(meta: IWindowMeta) {
    this.meta.next(meta);
    this.state.next(WindowState.Waiting);
    if (this.shouldActivate) {
      this.state.next(WindowState.Pulling);
      this.startRequest();
    }
  }

  public containsTimestamp(midTime: Date) {
    let wind = this;
    return wind.state.value !== WindowState.Pending &&
           wind.meta.value.startBound.getTime() <= midTime.getTime() &&
           (!wind.meta.value.endBound ||
            wind.meta.value.endBound.getTime() >= midTime.getTime());
  }

  public activate() {
    this.shouldActivate = true;
    if (this.state.value !== WindowState.Waiting) {
      return;
    }
    this.state.next(WindowState.Pulling);
    this.startRequest();
  }

  // Release everything
  public dispose() {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    this.killCall();
    if (!this.state.hasError && this.state.value !== WindowState.Committed) {
      this.state.error(WindowErrors.GenericFailure());
    }
  }

  private killCall() {
    if (this.callHandle) {
      try {
        this.callHandle.terminate();
      } catch (e) {
        // do nothing
      }
      this.callHandle = null;
    }
  }

  private buildBoundedHistoryRequest(boundsOnly: boolean): IBoundedStateHistoryRequest {
    return {
      context: this.streamContext,
      midTimestamp: (this.midTimestamp || new Date()).getTime(),
      mode: BoundedStateHistoryMode.SNAPSHOT_BOUND,
      boundsOnly: boundsOnly,
    };
  }

  private startRequest() {
    try {
      let req: IBoundedStateHistoryRequest = this.buildBoundedHistoryRequest(this.state.value === WindowState.Pending);
      let ch = this.callHandle = this.serviceHandle['getBoundedStateHistory'](req);
      this.callHandle.on('data', (data: IBoundedStateHistoryResponse) => {
        if (this.callHandle !== ch) {
          return;
        }
        this.handleData(data);
      });
      this.callHandle.on('error', (err: any) => {
        if (this.callHandle !== ch) {
          return;
        }
        this.failWithError(err);
      });
      this.callHandle.on('end', () => {
        if (this.callHandle !== ch) {
          return;
        }
        this.handleEnded();
      });
    } catch (e) {
      this.failWithError(e);
    }
  }

  private decodeState(state: IStateEntry): StreamEntry {
    if (!state || !state.jsonState || !state.jsonState.length) {
      return null;
    }
    let data = JSON.parse(state.jsonState);
    let timestamp: any = state.timestamp;
    if (timestamp && typeof timestamp.toNumber === 'function') {
      timestamp = timestamp.toNumber();
    }
    return {
      data,
      timestamp: new Date(timestamp),
      type: state.type,
    };
  }

  private failWithError(error: any) {
    if (!this.state.hasError) {
      this.state.error(error);
    }
    this.dispose();
  }

  private handleData(data: IBoundedStateHistoryResponse) {
    if (this.state.hasError ||
        this.state.value === WindowState.Committed ||
        this.isDisposed ||
        !this.callHandle) {
      return;
    }

    let decodedState = this.decodeState(data.state);
    switch (data.status) {
      case BoundedStateHistoryStatus.BOUNDED_HISTORY_START_BOUND:
        this.startBoundEntry = decodedState;
        if (!this.startBoundEntry) {
          this.failWithError(WindowErrors.OutOfRange());
          return;
        }
        this.pendingMeta.startBound = decodedState.timestamp;
        if (this.state.value === WindowState.Pulling || this.state.value === WindowState.Live) {
          this.data.saveEntry(decodedState);
        }
        break;
      case BoundedStateHistoryStatus.BOUNDED_HISTORY_END_BOUND:
        this.endBoundEntry = decodedState;
        if (this.endBoundEntry) {
          this.pendingMeta.endBound = decodedState.timestamp;
        }
        if (!this.meta.value && this.state.value === WindowState.Pending) {
          this.meta.next(this.pendingMeta);
          this.state.next(WindowState.Waiting);
          if (this.shouldActivate) {
            this.state.next(WindowState.Pulling);
            this.startRequest();
          }
        } else if (this.state.value === WindowState.Live) {
          this.data.saveEntry(this.endBoundEntry);
          this.state.next(WindowState.Committed);
          return;
        }
        break;
      case BoundedStateHistoryStatus.BOUNDED_HISTORY_INITIAL_SET:
        if (this.state.value !== WindowState.Pulling && this.state.value !== WindowState.Live) {
          return;
        }
        this.data.saveEntry(decodedState);
        break;
      case BoundedStateHistoryStatus.BOUNDED_HISTORY_TAIL:
        if (!decodedState) {
          if (this.meta.value.endBound) {
            this.data.saveEntry(this.endBoundEntry);
            this.state.next(WindowState.Committed);
          } else {
            this.state.next(WindowState.Live);
          }
          return;
        }
        this.data.saveEntry(decodedState);
        break;
    }
  }

  private handleEnded() {
    this.killCall();
    if (this.state.hasError) {
      return;
    }
    this.dispose();
  }
}
