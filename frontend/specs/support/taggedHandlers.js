const HANDLER_NAMES = [
  'onRetry', 'onDismissNotice', 'onOpenAdd', 'onCancelAdd', 'onPickType', 'onAddLabelChange', 'onAddCredentialChange',
  'onSubmitAdd', 'onStartRename', 'onRenameChange', 'onCancelRename', 'onSubmitRename',
  'onStartReplace', 'onReplaceCredentialChange', 'onCancelReplace', 'onSubmitReplace', 'onReconnect',
  'onAskRemove', 'onCancelRemove', 'onConfirmRemove', 'onTest',
];

/**
 * Build fake Integrations page handlers: each is a spy returning a tag naming the handler and
 * its arguments (e.g. `'onTest:abc'`), so specs can check which curried handler a control got.
 *
 * @returns {object} The fake handlers, keyed by handler name.
 */
export function taggedHandlers() {
  return Object.fromEntries(HANDLER_NAMES.map((name) => [
    name,
    jasmine.createSpy(name).and.callFake((...args) => [name, ...args.map((arg) => arg?.id ?? arg)].join(':')),
  ]));
}
