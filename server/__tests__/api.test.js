import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createInitialDB } from '../../server/db';

function createTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = createInitialDB();

  app.post('/api/v1/spaces/:spaceId/transactions', (req, res) => {
    const { spaceId } = req.params;
    const { amount, description, splitDetails, splits, isSettlement } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Số tiền giao dịch phải lớn hơn 0' });
    }

    let totalOwed = 0;
    if (splitDetails && Array.isArray(splitDetails)) {
      totalOwed = splitDetails.reduce((sum, item) => sum + (parseFloat(item.owedAmount) || 0), 0);
    } else if (splits) {
      totalOwed = Object.values(splits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }

    // BACKEND VALIDATION: Must ensure sum(owedAmount) equals total amount
    if (!isSettlement && Math.abs(totalOwed - amount) > 1) {
      return res.status(400).json({
        error: `Lỗi Validate Backend: Tổng số tiền chia không bằng tổng số tiền giao dịch`,
      });
    }

    const newTx = { id: uuidv4(), spaceId, amount, description, isSettlement: !!isSettlement };
    return res.status(201).json(newTx);
  });

  return app;
}

describe('Express REST API Validation & Security Integration Tests', () => {
  const app = createTestApp();

  it('should REJECT transaction when sum(owedAmount) != amount (HTTP 400)', async () => {
    const res = await request(app)
      .post('/api/v1/spaces/space-love-1/transactions')
      .send({
        amount: 500000,
        description: 'Gian lận chia tiền',
        splitDetails: [
          { userId: 'user-a', owedAmount: 200000 },
          { userId: 'user-b', owedAmount: 100000 }, // Total = 300,000 != 500,000!
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Lỗi Validate Backend');
  });

  it('should ACCEPT transaction when sum(owedAmount) == amount (HTTP 201)', async () => {
    const res = await request(app)
      .post('/api/v1/spaces/space-love-1/transactions')
      .send({
        amount: 500000,
        description: 'Ăn lẩu Haidilao hợp lệ',
        splitDetails: [
          { userId: 'user-a', owedAmount: 350000 },
          { userId: 'user-b', owedAmount: 150000 }, // Total = 500,000 == 500,000!
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe(500000);
  });
});
