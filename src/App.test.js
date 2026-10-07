import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn((url) => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(url.includes('/summary')
      ? { total: 0, count: 0, byCategory: {} }
      : []),
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('renders the expense dashboard and loads summary data', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /your money, in focus/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /add an expense/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText('Loading your expenses…')).not.toBeInTheDocument());
});

test('submits a new expense to the API', async () => {
  global.fetch.mockImplementation((url, options) => Promise.resolve({
    ok: true,
    status: options && options.method === 'POST' ? 201 : 200,
    json: () => Promise.resolve(url.includes('/summary')
      ? { total: 24.5, count: 1, byCategory: { Food: 24.5 } }
      : [{ id: 1, title: 'Lunch', amount: 24.5, category: 'Food', expenseDate: '2026-10-07' }]),
  }));
  render(<App />);
  await waitFor(() => expect(screen.queryByText('Loading your expenses…')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('What was it for?'), { target: { value: 'Lunch' } });
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '24.50' } });
  fireEvent.click(screen.getByRole('button', { name: /add expense/i }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/expenses', expect.objectContaining({ method: 'POST' })));
  await waitFor(() => expect(screen.getByText('Lunch')).toBeInTheDocument());
});
