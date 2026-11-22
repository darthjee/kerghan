import AttachWarning from '../../../../../../../../assets/js/components/resources/issues/link/modals/attachWarning.js';

describe('AttachWarning', () => {
  describe('.sentence', () => {
    it('names one field', () => {
      expect(AttachWarning.sentence(['title'])).toBe('GitHub\'s title will replace this issue\'s title.');
    });

    it('names two fields in the table order', () => {
      expect(AttachWarning.sentence(['body', 'title'])).toBe('GitHub\'s title and body will replace this issue\'s title and body.');
    });

    it('names three fields', () => {
      expect(AttachWarning.sentence(['state', 'body', 'title']))
        .toBe('GitHub\'s title, body and state will replace this issue\'s title, body and state.');
    });

    it('drops anything that is not a known field name, so no GitHub content is echoed', () => {
      expect(AttachWarning.sentence(['title', '<script>alert(1)</script>'])).toBe('GitHub\'s title will replace this issue\'s title.');
    });

    [undefined, [], ['other'], 'title', null].forEach((differences) => {
      it(`falls back to a generic sentence for ${JSON.stringify(differences)}`, () => {
        expect(AttachWarning.sentence(differences)).toBe('GitHub\'s values will replace this issue\'s values.');
      });
    });
  });
});
