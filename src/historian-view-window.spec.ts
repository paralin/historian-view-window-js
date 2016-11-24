import {
  HistorianViewWindow,
} from './historian-view-window';
import {
  WindowState,
} from '@fusebot/remote-state-stream';
import {
  MockViewService,
} from './mock/service';
import {
  mockTime,
} from './mock/time';

describe('HistorianViewWindow', () => {
  let window: HistorianViewWindow;
  let mockService: MockViewService;

  beforeEach(() => {
    mockService = new MockViewService();
    window = new HistorianViewWindow(<any>mockService, {});
  });

  it('should fetch the metadata with a mid timestamp', (done) => {
    window.state.subscribe((state) => {
      if (state === WindowState.Waiting) {
        expect(window.meta.value).not.toBe(null);
        done();
      }
    }, (err) => {
      //
    });
    window.initWithMidTimestamp(mockTime(-5));
  });

  it('should go out of range with an invalid timestamp', (done) => {
    window.state.subscribe((state) => {
      expect(state).toBeLessThan(WindowState.Committed);
    }, (err) => {
      done();
    });
    window.initWithMidTimestamp(mockTime(-50));
  });

  it('should pull data correctly', (done) => {
    let lastState = WindowState.Pending;
    window.state.subscribe((state) => {
      expect(state).toBeGreaterThanOrEqual(lastState);
      if (state === WindowState.Waiting) {
        window.activate();
      }
      if (state === WindowState.Committed) {
        done();
      }
    }, (err) => {
      //
    });
    window.initWithMidTimestamp(mockTime(-5));
  });
});
