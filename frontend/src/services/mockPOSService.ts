
export interface MockTransaction {
  id: string;
  type: 'CREDIT' | 'PAYMENT';
  amount: number;
  date: string;
  note?: string;
  paymentMode?: string;
  orderId?: string;
}

export interface MockOrder {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  amount: number;
  paymentType: 'Credit' | 'Paid';
  itemsString: string;
  images?: string[];
}

export interface MockCustomer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  totalCredit: number;
  totalPaid: number;
  transactions: MockTransaction[];
  orders: MockOrder[];
}

const STORAGE_KEY = 'mock_pos_customers';

export const getMockCustomers = (): MockCustomer[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  return JSON.parse(data);
};

export const getMockCustomer = (id: string): MockCustomer | undefined => {
  const customers = getMockCustomers();
  return customers.find(c => c.id === id);
};

export const saveMockCustomers = (customers: MockCustomer[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
};

export const createMockCustomer = (name: string, phone: string): MockCustomer => {
  const customers = getMockCustomers();
  const existing = customers.find(c => c.phone === phone);
  if (existing) return existing;

  const newCustomer: MockCustomer = {
    id: 'cust_' + Date.now(),
    name,
    phone,
    balance: 0,
    totalCredit: 0,
    totalPaid: 0,
    transactions: [],
    orders: []
  };
  customers.push(newCustomer);
  saveMockCustomers(customers);
  return newCustomer;
};

// Ensure a customer exists (used when POS selects a customer)
export const ensureMockCustomerBase = (apiCustomer: { _id: string, name: string, phone: string, email?: string }) => {
    let customers = getMockCustomers();
    let cust = customers.find(c => c.phone === apiCustomer.phone || c.name === apiCustomer.name); // Simple match

    if (!cust) {
        cust = {
            id: apiCustomer._id || 'cust_' + Date.now(),
            name: apiCustomer.name,
            phone: apiCustomer.phone || '',
            balance: 0,
            totalCredit: 0,
            totalPaid: 0,
            transactions: [],
            orders: []
        };
        customers.push(cust);
        saveMockCustomers(customers);
    }
    return cust;
};

export const addMockCredit = (customerId: string, amount: number, note: string, date: string, orderId?: string) => {
  const customers = getMockCustomers();
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return;

  customer.balance += amount;
  customer.totalCredit += amount;
  customer.transactions.unshift({
    id: 'txn_' + Date.now(),
    type: 'CREDIT',
    amount,
    date,
    note,
    orderId
  });

  saveMockCustomers(customers);
};

export const addMockPayment = (customerId: string, amount: number, mode: string, note: string, date: string) => {
  const customers = getMockCustomers();
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return;

  customer.balance -= amount;
  customer.totalPaid += amount;
  customer.transactions.unshift({
    id: 'txn_' + Date.now(),
    type: 'PAYMENT',
    amount,
    date,
    note,
    paymentMode: mode
  });

  saveMockCustomers(customers);
};

export const addMockOrder = (customerId: string, order: MockOrder) => {
    const customers = getMockCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    customer.orders.unshift(order);

    // If credit order, add to ledger
    if (order.paymentType === 'Credit') {
       customer.balance += order.amount;
       customer.totalCredit += order.amount;
       customer.transactions.unshift({
           id: 'txn_ord_' + Date.now(),
           type: 'CREDIT',
           amount: order.amount,
           date: order.date,
           note: `Order #${order.id}`,
           orderId: order.id
       });
    }

    saveMockCustomers(customers);
};

// Initialize some dummy data if empty
export const initializeMockData = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        const dummyCustomers: MockCustomer[] = [
            {
                id: 'cust_1',
                name: 'Shubham',
                phone: '8349400273',
                balance: 378,
                totalCredit: 758,
                totalPaid: 380,
                transactions: [
                    { id: 't1', type: 'CREDIT', amount: 150, date: '2025-12-20', note: 'Order #ORD-0013', orderId: 'ORD-0013' },
                    { id: 't2', type: 'PAYMENT', amount: 99, date: '2025-11-06', note: 'Partial payment', paymentMode: 'UPI' },
                    { id: 't3', type: 'CREDIT', amount: 30, date: '2025-11-04', note: 'Order #ORD-0004', orderId: 'ORD-0004' },
                ],
                orders: [
                    { id: 'ORD-0013', customerId: 'cust_1', customerName: 'Shubham', date: '2025-12-20', amount: 150, paymentType: 'Credit', itemsString: 'Deo - Yellow x 1', images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200'] },
                    { id: 'ORD-0004', customerId: 'cust_1', customerName: 'Shubham', date: '2025-11-04', amount: 30, paymentType: 'Paid', itemsString: 'Ox Pen x 3', images: ['https://images.unsplash.com/photo-1583324113626-70df0f4deaab?auto=format&fit=crop&q=80&w=200'] },
                ]
            },
            {
                id: 'cust_2',
                name: 'Rahul',
                phone: '9876543210',
                balance: 0,
                totalCredit: 500,
                totalPaid: 500,
                transactions: [],
                orders: []
            }
        ];
        saveMockCustomers(dummyCustomers);
    }
};
