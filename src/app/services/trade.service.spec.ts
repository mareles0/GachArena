import { TradeService } from './trade.service';
import * as firestore from 'firebase/firestore';

describe('TradeService', () => {
  let service: TradeService;

  beforeEach(() => {
    service = new TradeService();
  });

  it('should create trade and return id', async () => {
    spyOn(firestore, 'addDoc').and.returnValue(Promise.resolve({ id: 'trade123' } as any));

    const tradeData = { fromUserId: 'u1', toUserId: 'u2', offeredUserItemIds: ['a'], requestedUserItemIds: ['b'] } as any;
    const id = await service.createTrade(tradeData);
    expect(id).toBe('trade123');
    expect(firestore.addDoc).toHaveBeenCalled();
  });

  it('acceptTrade should throw if trade not found', async () => {
    // Mock runTransaction to call callback with tx.get returning a snap that does not exist
    spyOn(firestore, 'runTransaction').and.callFake(async (_db: any, updateFn: any) => {
      return updateFn({ get: async () => ({ exists: false }) });
    });

    let threw = false;
    try {
      await service.acceptTrade('nonexistent');
    } catch (e) {
      threw = true;
    }
    expect(threw).toBeTrue();
  });
});