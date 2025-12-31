import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import restaurantRoutes from './routes/restaurants.routes';
import menuRoutes from './routes/menu.routes';
import orderRoutes from './routes/orders.routes';
import courierRoutes from './routes/courier.routes';
import paymentRoutes from './routes/payments.routes';
import ratingRoutes from './routes/ratings.routes';
import analyticsRoutes from './routes/analytics.routes';
import adminRoutes from './routes/admin.routes';
import userRoutes from './routes/users.routes';
import { setupSwagger } from './swagger/swagger';

dotenv.config();

const app: Application = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Swagger Documentation
setupSwagger(app);

// Routes
app.use('/auth', authRoutes);
app.use('/restaurants', restaurantRoutes);
app.use('/menu', menuRoutes);
app.use('/orders', orderRoutes);
app.use('/courier', courierRoutes);
app.use('/payments', paymentRoutes);
app.use('/ratings', ratingRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/admin', adminRoutes);
app.use('/users', userRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Yemeksepeti Clone API is running' });
});

// Basic Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

export default app;

