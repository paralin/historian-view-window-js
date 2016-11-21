import {
  IStateContext,
} from '@fusebot/fusecloud-common';
import {
  WindowMultiplexerFactory,
  WindowFactory,
} from '@fusebot/remote-state-stream';
import {
  IServiceHandle,
} from 'grpc-bus';
import {
  HistorianViewWindow,
} from './historian-view-window';

export interface IServiceReferenceHandle {
  handle: IServiceHandle;
  factory: WindowFactory;
}

// Accepts multiple service handles and outputs windows.
export class HistorianViewMultiplexer {
  public windowMultiplexerFactory: WindowMultiplexerFactory;

  private serviceReferences: IServiceReferenceHandle[] = [];

  constructor(private stateContext: IStateContext) {
    this.windowMultiplexerFactory = new WindowMultiplexerFactory();
  }

  public addService(handle: IServiceHandle) {
    if (this.indexOfHandle(handle) !== -1) {
      return;
    }

    let ref: IServiceReferenceHandle = {
      handle: handle,
      factory: () => {
        return new HistorianViewWindow(handle, this.stateContext);
      },
    };
    this.serviceReferences.push(ref);
    this.windowMultiplexerFactory.addFactory(ref.factory);
  }

  public deleteService(handle: IServiceHandle) {
    let idx = this.indexOfHandle(handle);
    if (idx === -1) {
      return;
    }

    let ref = this.serviceReferences.splice(idx, 1)[0];
    this.windowMultiplexerFactory.deleteFactory(ref.factory);
  }

  public getFactoryFcn(): WindowFactory {
    return this.windowMultiplexerFactory.getFactoryFcn();
  }

  private indexOfHandle(handle: IServiceHandle) {
    let i = 0;
    for (let ref of this.serviceReferences) {
      if (ref.handle === handle) {
        return i;
      }
      i++;
    }
    return -1;
  }
}
