import {
  HistorianViewMultiplexer,
} from './historian-view-multiplexer';
import {
  WindowState,
  WindowFactory,
} from '@fusebot/remote-state-stream';
import {
  MockViewService,
} from './mock/service';
import {
  mockTime,
} from './mock/time';

describe('HistorianViewMultiplexer', () => {
  let multi: HistorianViewMultiplexer;
  let mockServiceA: MockViewService;
  let mockServiceB: MockViewService;
  let factory: WindowFactory;

  beforeEach(() => {
    mockServiceA = new MockViewService();
    mockServiceB = new MockViewService();
    multi = new HistorianViewMultiplexer({});
    multi.addService(<any>mockServiceA);
    multi.addService(<any>mockServiceB);
    factory = multi.getFactoryFcn();
  });

  it('should fetch the metadata with a mid timestamp', (done) => {
    let window = factory();
    window.state.subscribe((state) => {
      if (state === WindowState.Waiting) {
        expect(window.meta.value).not.toBe(null);
        done();
      }
    });
    window.initWithMidTimestamp(mockTime(-5));
  });

  it('should pull data correctly', (done) => {
    let window = factory();
    let lastState = WindowState.Pending;
    window.state.subscribe((state) => {
      expect(state).toBeGreaterThanOrEqual(lastState);
      expect(state).not.toBe(WindowState.Failed);
      if (state === WindowState.Waiting) {
        window.activate();
      }
      if (state === WindowState.Committed) {
        done();
      }
    });
    window.initWithMidTimestamp(mockTime(-5));
  });
});
