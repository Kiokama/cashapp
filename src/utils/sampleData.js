import { generateId, generateInviteCode } from './helpers';

const now = new Date();
const thisMonth = now.getMonth();
const thisYear = now.getFullYear();

function d(month, day) {
  return new Date(thisYear, month, day).toISOString();
}

const USER_A = {
  id: 'user-a',
  name: 'Minh Anh',
  email: 'minhanh@email.com',
  avatar: null,
};

const USER_B = {
  id: 'user-b',
  name: 'Thuỳ Linh',
  email: 'thuylinh@email.com',
  avatar: null,
};

export function createSampleData() {
  const spaceId = generateId();

  const transactions = [
    // This month
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 450000,
      category: 'food', description: 'Ăn tối nhà hàng Nhật',
      date: d(thisMonth, 2), splitType: 'equal',
      splits: { [USER_A.id]: 225000, [USER_B.id]: 225000 },
      createdAt: d(thisMonth, 2), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 1200000,
      category: 'housing', description: 'Tiền điện tháng này',
      date: d(thisMonth, 5), splitType: 'equal',
      splits: { [USER_A.id]: 600000, [USER_B.id]: 600000 },
      createdAt: d(thisMonth, 5), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 320000,
      category: 'dating', description: 'Xem phim & bỏng ngô',
      date: d(thisMonth, 8), splitType: 'percentage',
      splits: { [USER_A.id]: 224000, [USER_B.id]: 96000 },
      createdAt: d(thisMonth, 8), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 650000,
      category: 'shopping', description: 'Mua đồ gia dụng',
      date: d(thisMonth, 12), splitType: 'equal',
      splits: { [USER_A.id]: 325000, [USER_B.id]: 325000 },
      createdAt: d(thisMonth, 12), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 180000,
      category: 'transport', description: 'Grab đi chơi cuối tuần',
      date: d(thisMonth, 15), splitType: 'equal',
      splits: { [USER_A.id]: 90000, [USER_B.id]: 90000 },
      createdAt: d(thisMonth, 15), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 280000,
      category: 'food', description: 'Đi cafe cuối tuần',
      date: d(thisMonth, 18), splitType: 'equal',
      splits: { [USER_A.id]: 140000, [USER_B.id]: 140000 },
      createdAt: d(thisMonth, 18), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 950000,
      category: 'entertainment', description: 'Vé concert Hà Anh Tuấn',
      date: d(thisMonth, 20), splitType: 'equal',
      splits: { [USER_A.id]: 475000, [USER_B.id]: 475000 },
      createdAt: d(thisMonth, 20), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 520000,
      category: 'food', description: 'Đi siêu thị mua đồ ăn',
      date: d(thisMonth, 22), splitType: 'exact',
      splits: { [USER_A.id]: 200000, [USER_B.id]: 320000 },
      createdAt: d(thisMonth, 22), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 350000,
      category: 'health', description: 'Mua thuốc & vitamin',
      date: d(thisMonth, 25), splitType: 'equal',
      splits: { [USER_A.id]: 175000, [USER_B.id]: 175000 },
      createdAt: d(thisMonth, 25), isSettlement: false,
    },

    // Last month
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 380000,
      category: 'food', description: 'Ăn lẩu cuối tuần',
      date: d(thisMonth - 1, 5), splitType: 'equal',
      splits: { [USER_A.id]: 190000, [USER_B.id]: 190000 },
      createdAt: d(thisMonth - 1, 5), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 1100000,
      category: 'housing', description: 'Tiền nước + internet',
      date: d(thisMonth - 1, 10), splitType: 'equal',
      splits: { [USER_A.id]: 550000, [USER_B.id]: 550000 },
      createdAt: d(thisMonth - 1, 10), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 750000,
      category: 'dating', description: 'Kỷ niệm 1 năm yêu nhau',
      date: d(thisMonth - 1, 14), splitType: 'percentage',
      splits: { [USER_A.id]: 525000, [USER_B.id]: 225000 },
      createdAt: d(thisMonth - 1, 14), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 420000,
      category: 'shopping', description: 'Quần áo mới',
      date: d(thisMonth - 1, 20), splitType: 'equal',
      splits: { [USER_A.id]: 210000, [USER_B.id]: 210000 },
      createdAt: d(thisMonth - 1, 20), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 200000,
      category: 'utilities', description: 'Nạp điện thoại',
      date: d(thisMonth - 1, 25), splitType: 'equal',
      splits: { [USER_A.id]: 100000, [USER_B.id]: 100000 },
      createdAt: d(thisMonth - 1, 25), isSettlement: false,
    },

    // 2 months ago
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 890000,
      category: 'food', description: 'Buffet cuối tuần',
      date: d(thisMonth - 2, 3), splitType: 'equal',
      splits: { [USER_A.id]: 445000, [USER_B.id]: 445000 },
      createdAt: d(thisMonth - 2, 3), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 1500000,
      category: 'housing', description: 'Tiền điện nước',
      date: d(thisMonth - 2, 8), splitType: 'equal',
      splits: { [USER_A.id]: 750000, [USER_B.id]: 750000 },
      createdAt: d(thisMonth - 2, 8), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 300000,
      category: 'entertainment', description: 'Karaoke tối thứ 7',
      date: d(thisMonth - 2, 15), splitType: 'equal',
      splits: { [USER_A.id]: 150000, [USER_B.id]: 150000 },
      createdAt: d(thisMonth - 2, 15), isSettlement: false,
    },

    // 3 months ago
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 600000,
      category: 'food', description: 'Đi ăn hải sản',
      date: d(thisMonth - 3, 7), splitType: 'equal',
      splits: { [USER_A.id]: 300000, [USER_B.id]: 300000 },
      createdAt: d(thisMonth - 3, 7), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 1300000,
      category: 'housing', description: 'Tiền nhà tháng 4',
      date: d(thisMonth - 3, 10), splitType: 'equal',
      splits: { [USER_A.id]: 650000, [USER_B.id]: 650000 },
      createdAt: d(thisMonth - 3, 10), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 450000,
      category: 'dating', description: 'Đi chơi Đà Lạt (ăn uống)',
      date: d(thisMonth - 3, 18), splitType: 'equal',
      splits: { [USER_A.id]: 225000, [USER_B.id]: 225000 },
      createdAt: d(thisMonth - 3, 18), isSettlement: false,
    },

    // 4 months ago
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 850000,
      category: 'transport', description: 'Xăng xe tháng 3',
      date: d(thisMonth - 4, 5), splitType: 'equal',
      splits: { [USER_A.id]: 425000, [USER_B.id]: 425000 },
      createdAt: d(thisMonth - 4, 5), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 550000,
      category: 'food', description: 'Mua đồ ăn tuần',
      date: d(thisMonth - 4, 12), splitType: 'equal',
      splits: { [USER_A.id]: 275000, [USER_B.id]: 275000 },
      createdAt: d(thisMonth - 4, 12), isSettlement: false,
    },

    // 5 months ago
    {
      id: generateId(), spaceId, paidBy: USER_B.id, amount: 720000,
      category: 'shopping', description: 'Mua nội thất mới',
      date: d(thisMonth - 5, 8), splitType: 'equal',
      splits: { [USER_A.id]: 360000, [USER_B.id]: 360000 },
      createdAt: d(thisMonth - 5, 8), isSettlement: false,
    },
    {
      id: generateId(), spaceId, paidBy: USER_A.id, amount: 400000,
      category: 'entertainment', description: 'Vé bảo tàng + cafe',
      date: d(thisMonth - 5, 20), splitType: 'equal',
      splits: { [USER_A.id]: 200000, [USER_B.id]: 200000 },
      createdAt: d(thisMonth - 5, 20), isSettlement: false,
    },
  ];

  const space = {
    id: spaceId,
    name: 'Không gian của chúng ta',
    emoji: '💕',
    inviteCode: generateInviteCode(),
    members: [USER_A.id, USER_B.id],
    createdAt: d(thisMonth - 6, 1),
    budgets: {
      food: 3000000,
      housing: 2000000,
      dating: 1500000,
      shopping: 1000000,
      transport: 800000,
      entertainment: 1000000,
    },
  };

  const auditLog = transactions.slice(0, 5).map((tx, i) => ({
    id: generateId(),
    transactionId: tx.id,
    action: i === 0 ? 'edited' : 'created',
    userId: i % 2 === 0 ? USER_A.id : USER_B.id,
    timestamp: tx.createdAt,
    changes: i === 0 ? { amount: { from: 400000, to: 450000 } } : null,
    description: tx.description,
  }));

  const notifications = [
    {
      id: generateId(), type: 'expense_added', read: false,
      message: 'Thuỳ Linh đã thêm khoản chi "Mua thuốc & vitamin" — 350,000₫',
      timestamp: d(thisMonth, 25), userId: USER_B.id,
    },
    {
      id: generateId(), type: 'expense_added', read: false,
      message: 'Bạn đã thêm khoản chi "Đi siêu thị mua đồ ăn" — 520,000₫',
      timestamp: d(thisMonth, 22), userId: USER_A.id,
    },
    {
      id: generateId(), type: 'settle_request', read: true,
      message: 'Thuỳ Linh yêu cầu thanh toán số dư hiện tại',
      timestamp: d(thisMonth, 20), userId: USER_B.id,
    },
    {
      id: generateId(), type: 'budget_warning', read: true,
      message: 'Chi tiêu "Ăn uống" đã đạt 80% ngân sách tháng này!',
      timestamp: d(thisMonth, 18), userId: 'system',
    },
  ];

  return {
    currentUser: USER_A,
    users: { [USER_A.id]: USER_A, [USER_B.id]: USER_B },
    spaces: { [spaceId]: space },
    activeSpaceId: spaceId,
    transactions,
    auditLog,
    notifications,
  };
}
