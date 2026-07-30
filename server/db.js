import { v4 as uuidv4 } from 'uuid';

export function createInitialDB() {
  const userA = {
    id: 'user-a',
    name: 'Minh Anh',
    email: 'minhanh@email.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  };

  const userB = {
    id: 'user-b',
    name: 'Thuỳ Linh',
    email: 'thuylinh@email.com',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
  };

  const spaceId = 'space-love-1';

  const space = {
    id: spaceId,
    name: 'Không gian của chúng ta',
    emoji: '💕',
    inviteCode: '7WNJW4',
    members: [userA.id, userB.id],
    createdAt: '2026-06-01T00:00:00Z',
    budgets: {
      food: 3000000,
      housing: 2000000,
      dating: 1500000,
      shopping: 1000000,
      transport: 800000,
      entertainment: 1000000,
      health: 500000,
      other: 500000,
    },
  };

  const transactions = [
    {
      id: uuidv4(),
      spaceId,
      amount: 350000,
      description: 'Mua thuốc & vitamin',
      category: 'health',
      date: '2026-07-25T14:30:00Z',
      paidBy: userB.id,
      splitType: 'SPLIT_EQUAL',
      splitDetails: [
        { userId: userA.id, owedAmount: 175000, percentage: 50 },
        { userId: userB.id, owedAmount: 175000, percentage: 50 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
    {
      id: uuidv4(),
      spaceId,
      amount: 520000,
      description: 'Đi siêu thị mua đồ ăn',
      category: 'food',
      date: '2026-07-22T18:45:00Z',
      paidBy: userA.id,
      splitType: 'SPLIT_PERCENTAGE',
      splitDetails: [
        { userId: userA.id, owedAmount: 200000, percentage: 38.46 },
        { userId: userB.id, owedAmount: 320000, percentage: 61.54 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
    {
      id: uuidv4(),
      spaceId,
      amount: 950000,
      description: 'Vé concert Hà Anh Tuấn',
      category: 'entertainment',
      date: '2026-07-20T20:00:00Z',
      paidBy: userB.id,
      splitType: 'SPLIT_EQUAL',
      splitDetails: [
        { userId: userA.id, owedAmount: 475000, percentage: 50 },
        { userId: userB.id, owedAmount: 475000, percentage: 50 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
    {
      id: uuidv4(),
      spaceId,
      amount: 280000,
      description: 'Đi cafe cuối tuần',
      category: 'food',
      date: '2026-07-18T10:15:00Z',
      paidBy: userA.id,
      splitType: 'SPLIT_EQUAL',
      splitDetails: [
        { userId: userA.id, owedAmount: 140000, percentage: 50 },
        { userId: userB.id, owedAmount: 140000, percentage: 50 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
    {
      id: uuidv4(),
      spaceId,
      amount: 180000,
      description: 'Grab đi chơi cuối tuần',
      category: 'transport',
      date: '2026-07-15T19:30:00Z',
      paidBy: userA.id,
      splitType: 'SPLIT_EQUAL',
      splitDetails: [
        { userId: userA.id, owedAmount: 90000, percentage: 50 },
        { userId: userB.id, owedAmount: 90000, percentage: 50 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
    {
      id: uuidv4(),
      spaceId,
      amount: 650000,
      description: 'Mua đồ gia dụng',
      category: 'shopping',
      date: '2026-07-12T15:20:00Z',
      paidBy: userB.id,
      splitType: 'SPLIT_EQUAL',
      splitDetails: [
        { userId: userA.id, owedAmount: 325000, percentage: 50 },
        { userId: userB.id, owedAmount: 325000, percentage: 50 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
    {
      id: uuidv4(),
      spaceId,
      amount: 320000,
      description: 'Xem phim & bỏng ngô',
      category: 'dating',
      date: '2026-07-08T21:00:00Z',
      paidBy: userA.id,
      splitType: 'SPLIT_EQUAL',
      splitDetails: [
        { userId: userA.id, owedAmount: 160000, percentage: 50 },
        { userId: userB.id, owedAmount: 160000, percentage: 50 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
    {
      id: uuidv4(),
      spaceId,
      amount: 1200000,
      description: 'Tiền điện nước tháng 7',
      category: 'housing',
      date: '2026-07-05T09:00:00Z',
      paidBy: userB.id,
      splitType: 'SPLIT_EQUAL',
      splitDetails: [
        { userId: userA.id, owedAmount: 600000, percentage: 50 },
        { userId: userB.id, owedAmount: 600000, percentage: 50 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
    {
      id: uuidv4(),
      spaceId,
      amount: 450000,
      description: 'Ăn trưa cuối tuần',
      category: 'food',
      date: '2026-07-02T12:30:00Z',
      paidBy: userA.id,
      splitType: 'SPLIT_EQUAL',
      splitDetails: [
        { userId: userA.id, owedAmount: 225000, percentage: 50 },
        { userId: userB.id, owedAmount: 225000, percentage: 50 },
      ],
      isSettlement: false,
      isDeleted: false,
    },
  ];

  return {
    currentUser: userA,
    users: { [userA.id]: userA, [userB.id]: userB },
    spaces: { [space.id]: space },
    transactions,
    auditLog: [],
  };
}
