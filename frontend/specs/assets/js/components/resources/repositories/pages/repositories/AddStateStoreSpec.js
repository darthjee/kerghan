import AddStateStore from '../../../../../../../../assets/js/components/resources/repositories/pages/repositories/AddStateStore.js';

describe('AddStateStore', () => {
  let publish;
  let store;

  beforeEach(() => {
    publish = jasmine.createSpy('publish');
    store = new AddStateStore(publish);
  });

  it('publishes a pending entry', () => {
    store.pending(7);

    expect(publish).toHaveBeenCalledWith(new Map([[7, { status: 'pending' }]]));
  });

  it('publishes a failure with its message and link', () => {
    store.fail(7, { message: 'nope', link: { href: '#', text: 'x' } });

    expect(publish).toHaveBeenCalledWith(new Map([
      [7, { status: 'error', message: 'nope', link: { href: '#', text: 'x' } }],
    ]));
  });

  it('forgets one entry', () => {
    store.pending(7);
    store.pending(8);
    store.clear(7);

    expect(publish.calls.mostRecent().args[0]).toEqual(new Map([[8, { status: 'pending' }]]));
  });

  it('forgets every entry', () => {
    store.pending(7);
    store.clearAll();

    expect(publish.calls.mostRecent().args[0]).toEqual(new Map());
  });

  it('publishes copies, not its own map', () => {
    store.pending(7);
    store.pending(8);

    expect(publish.calls.argsFor(0)[0].size).toBe(1);
  });
});
