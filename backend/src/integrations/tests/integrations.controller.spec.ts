import { IntegrationsController } from '../integrations.controller.js';
import type { IntegrationsService } from '../integrations.service.js';

const USER = { sub: 7 } as never;
const UUID = '11111111-1111-4111-8111-111111111111';

describe('IntegrationsController', () => {
  let service: Record<string, jest.Mock>;
  let controller: IntegrationsController;

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue(['a']),
      enabledTypes: jest.fn().mockReturnValue(['pat']),
      show: jest.fn().mockResolvedValue('shown'),
      create: jest.fn().mockResolvedValue('created'),
      rename: jest.fn().mockResolvedValue('renamed'),
      replaceCredential: jest.fn().mockResolvedValue('replaced'),
      test: jest.fn().mockResolvedValue('tested'),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    controller = new IntegrationsController(service as unknown as IntegrationsService);
  });

  it('wraps the caller\'s list', async () => {
    expect(await controller.mine(USER)).toEqual({ integrations: ['a'] });
    expect(service.list).toHaveBeenCalledWith(7);
  });

  it('wraps the enabled types', () => {
    expect(controller.types()).toEqual({ types: ['pat'] });
  });

  it('delegates every action with the caller\'s id', async () => {
    const dto = { credential: {} } as never;

    expect(await controller.show(UUID, USER)).toBe('shown');
    expect(await controller.create(dto, USER)).toBe('created');
    expect(await controller.rename(UUID, { label: 'New' }, USER)).toBe('renamed');
    expect(await controller.replaceCredential(UUID, dto, USER)).toBe('replaced');
    expect(await controller.test(UUID, USER)).toBe('tested');
    expect(await controller.remove(UUID, USER)).toBeUndefined();

    expect(service.show).toHaveBeenCalledWith(7, UUID);
    expect(service.create).toHaveBeenCalledWith(7, dto);
    expect(service.rename).toHaveBeenCalledWith(7, UUID, 'New');
    expect(service.replaceCredential).toHaveBeenCalledWith(7, UUID, dto);
    expect(service.test).toHaveBeenCalledWith(7, UUID);
    expect(service.delete).toHaveBeenCalledWith(7, UUID);
  });
});
