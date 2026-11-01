import express from 'express';
import cors from 'cors';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { registerRouter } from "./users/registerUser";
import { loginRouter } from "./users/loginUser";
import { googleAuthRouter } from "./users/googleAuth";
import { profileRouter } from "./users/profile";
import { createGroupRouter } from './groups/createGroup';
import { joinGroupRouter } from './groups/joinGroup';
import { joinRequestRouter } from './groups/joinRequests';
import { authenticate } from "./middleware/auth"
import { groupSettingsRouter } from './groups/groupSettings';
import { getGroupDetailsRouter } from './groups/getGroupDetails';
import { getGroupMembersRouter } from './groups/getGroupMembers';
import { getGroupBalanceRouter } from './groups/getGroupBalance';
import { getActivityRouter } from './groups/activity';
import { getSettlementRouter } from './groups/getSettlement';
import { joinRequestNotificationRouter } from './notifications/joinRequestNotifications';
import { notificationRouter } from './notifications/getNotifications';
import { createExpenseRouter } from './expenses/createExpense';
import { getExpensesRouter } from './expenses/getExpenses';
import { getExpenseDetailRouter } from './expenses/getExpenseDetail';
import { deleteExpenseRouter } from './expenses/deleteExpense';
import { updateExpenseRouter } from './expenses/updateExpense';
import { createPaymentRouter } from './payments/createPayment';
import { incomingPaymentsRouter } from './payments/getIncomingPayments';
import { approvePaymentRouter } from './payments/approvePayment';
import { rejectPaymentRouter } from './payments/rejectPayment';

const app = express();
const port = 3000;

// Middleware agar bisa menerima request JSON
app.use(express.json());

app.use(cors());

// Serve folder 'public' secara statis agar foto bisa diakses via URL
app.use('/public', express.static(path.join(process.cwd(), 'public')));

app.use('/auth', registerRouter);
app.use('/auth', loginRouter);
app.use('/auth', googleAuthRouter);

app.use('/users', profileRouter);

app.use('/groups', createGroupRouter);
app.use('/groups', joinGroupRouter);
app.use('/groups', joinRequestRouter);
app.use('/groups', groupSettingsRouter);
app.use('/groups', getGroupDetailsRouter);
app.use('/groups', getGroupMembersRouter);
app.use('/groups', getGroupBalanceRouter);
app.use('/groups', createExpenseRouter);
app.use('/groups', getExpensesRouter);
app.use('/groups', getActivityRouter);
app.use('/groups', getSettlementRouter);

app.use('/notifications', joinRequestNotificationRouter);
app.use('/notifications', notificationRouter);

app.use('/expenses', getExpenseDetailRouter);
app.use('/expenses', deleteExpenseRouter);
app.use('/expenses', updateExpenseRouter);

app.use('/payments', createPaymentRouter);
app.use('/payments', incomingPaymentsRouter);
app.use('/payments', approvePaymentRouter);
app.use('/payments', rejectPaymentRouter);


// Rute tes dasar
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend Bill Splitter menyala!' });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({
    message: "Selamat datang, token kamu asli",
    user: res.locals.user
  });
});

app.use(errorHandler);

// Menjalankan server hanya jika file ini dieksekusi langsung (bukan di-import oleh Vercel / tes)
if (require.main === module && process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
  });
}

// Mengekspor app agar bisa dibaca oleh Vercel
export default app;
