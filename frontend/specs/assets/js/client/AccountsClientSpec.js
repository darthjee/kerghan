import AccountsClient from '../../../../assets/js/client/AccountsClient.js';
import ApiClient from '../../../../assets/js/client/ApiClient.js';

describe('AccountsClient', () => {
  it('posts registration fields to the register endpoint, mapping to snake_case', async () => {
    spyOn(ApiClient, 'postJson').and.resolveTo({ id: 1, username: 'foo', email: 'foo@example.com' });

    await AccountsClient.register({
      username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
    });

    expect(ApiClient.postJson).toHaveBeenCalledWith('/accounts/register.json', {
      username: 'foo',
      email: 'foo@example.com',
      password: 'secret',
      password_confirmation: 'secret',
    });
  });

  it('resolves with the created account', async () => {
    const account = { id: 1, username: 'foo', email: 'foo@example.com' };
    spyOn(ApiClient, 'postJson').and.resolveTo(account);

    const result = await AccountsClient.register({
      username: 'foo', email: 'foo@example.com', password: 'secret', passwordConfirmation: 'secret',
    });

    expect(result).toEqual(account);
  });
});
