import type {
  PaymentGateway,
  PaymentOutcome,
  PaymentRequest,
} from '../../src/contexts/subscription/domain/payment-gateway.js';

export class FakePaymentGateway implements PaymentGateway {
  readonly calls: PaymentRequest[] = [];
  nextOutcome: PaymentOutcome | Error;

  constructor(nextOutcome: PaymentOutcome | Error) {
    this.nextOutcome = nextOutcome;
  }

  async pay(request: PaymentRequest): Promise<PaymentOutcome> {
    this.calls.push(request);

    if (this.nextOutcome instanceof Error) throw this.nextOutcome;
    return this.nextOutcome;
  }
}
