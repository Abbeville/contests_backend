import { AppDataSource } from '../config/database';
import { SupportTicket } from '../models/SupportTicket';
import { SupportMessage } from '../models/SupportMessage';
import { User } from '../models/User';
import { Notification } from '../models/Notification';

export class SupportService {
  // Create support ticket
  async createTicket(userId: string, ticketData: {
    subject: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    attachments?: string[];
  }) {
    const ticket = new SupportTicket();
    ticket.user_id = userId;
    (ticket as any).subject = ticketData.subject;
    ticket.description = ticketData.description;
    (ticket as any).priority = ticketData.priority as any;
    ticket.category = ticketData.category;
    (ticket as any).attachments = ticketData.attachments || [];
    (ticket as any).status = 'open';

    const savedTicket = await AppDataSource.getRepository(SupportTicket).save(ticket);

    // Create initial message
    const message = new SupportMessage();
    message.ticket_id = savedTicket.id;
    (message as any).user_id = userId;
    message.message = ticketData.description;
    (message as any).is_from_support = false;
    await AppDataSource.getRepository(SupportMessage).save(message);

    return savedTicket;
  }

  // Get user's support tickets
  async getUserTickets(userId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(SupportTicket)
      .createQueryBuilder('ticket')
      .where('ticket.user_id = :userId', { userId })
      .leftJoinAndSelect('ticket.messages', 'messages')
      .leftJoinAndSelect('messages.user', 'messageUser')
      .orderBy('ticket.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.status) {
      queryBuilder.andWhere('ticket.status = :status', { status: params.status });
    }

    if (params.priority) {
      queryBuilder.andWhere('ticket.priority = :priority', { priority: params.priority });
    }

    const [tickets, total] = await queryBuilder.getManyAndCount();

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get support ticket by ID
  async getTicketById(ticketId: string, userId?: string) {
    const queryBuilder = AppDataSource.getRepository(SupportTicket)
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .leftJoinAndSelect('ticket.messages', 'messages')
      .leftJoinAndSelect('messages.user', 'messageUser')
      .where('ticket.id = :ticketId', { ticketId });

    if (userId) {
      queryBuilder.andWhere('ticket.user_id = :userId', { userId });
    }

    const ticket = await queryBuilder.getOne();

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    return ticket;
  }

  // Add message to support ticket
  async addMessage(ticketId: string, userId: string, messageData: {
    message: string;
    is_from_support?: boolean;
    attachments?: string[];
  }) {
    const ticket = await AppDataSource.getRepository(SupportTicket).findOne({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    // Check if user has access to this ticket
    if (ticket.user_id !== userId && !messageData.is_from_support) {
      throw new Error('Access denied');
    }

    const message = new SupportMessage();
    message.ticket_id = ticketId;
    (message as any).user_id = userId;
    message.message = messageData.message;
    (message as any).is_from_support = messageData.is_from_support || false;
    (message as any).attachments = messageData.attachments || [];

    const savedMessage = await AppDataSource.getRepository(SupportMessage).save(message);

    // Update ticket status if it's from support
    if (messageData.is_from_support) {
      (ticket as any).status = 'in_progress';
      await AppDataSource.getRepository(SupportTicket).save(ticket);
    }

    return savedMessage;
  }

  // Update ticket status
  async updateTicketStatus(ticketId: string, status: string, adminId?: string) {
    const ticket = await AppDataSource.getRepository(SupportTicket).findOne({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    (ticket as any).status = status;
    if (adminId) {
      ticket.assigned_to = adminId;
    }

    await AppDataSource.getRepository(SupportTicket).save(ticket);

    // Create notification for user
    const notification = new Notification();
    notification.user_id = ticket.user_id;
    notification.title = 'Support Ticket Update';
    notification.message = `Your support ticket "${(ticket as any).subject}" status has been updated to ${status}`;
    notification.type = 'support';
    await AppDataSource.getRepository(Notification).save(notification);

    return ticket;
  }

  // Get all support tickets (admin)
  async getAllTickets(params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    search?: string;
    assigned_to?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(SupportTicket)
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .leftJoinAndSelect('ticket.messages', 'messages')
      .orderBy('ticket.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.status) {
      queryBuilder.andWhere('ticket.status = :status', { status: params.status });
    }

    if (params.priority) {
      queryBuilder.andWhere('ticket.priority = :priority', { priority: params.priority });
    }

    if (params.category) {
      queryBuilder.andWhere('ticket.category = :category', { category: params.category });
    }

    if (params.assigned_to) {
      queryBuilder.andWhere('ticket.assigned_to = :assignedTo', { assignedTo: params.assigned_to });
    }

    if (params.search) {
      queryBuilder.andWhere(
        '(ticket.subject ILIKE :search OR ticket.description ILIKE :search OR user.username ILIKE :search)',
        { search: `%${params.search}%` }
      );
    }

    const [tickets, total] = await queryBuilder.getManyAndCount();

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Assign ticket to admin
  async assignTicket(ticketId: string, adminId: string) {
    const ticket = await AppDataSource.getRepository(SupportTicket).findOne({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    ticket.assigned_to = adminId;
    (ticket as any).status = 'in_progress';

    await AppDataSource.getRepository(SupportTicket).save(ticket);

    return ticket;
  }

  // Get support statistics
  async getSupportStats() {
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      highPriorityTickets
    ] = await Promise.all([
      AppDataSource.getRepository(SupportTicket).count(),
      AppDataSource.getRepository(SupportTicket).count({ where: { status: 'open' as any } }),
      AppDataSource.getRepository(SupportTicket).count({ where: { status: 'in_progress' as any } }),
      AppDataSource.getRepository(SupportTicket).count({ where: { status: 'resolved' as any } }),
      AppDataSource.getRepository(SupportTicket).count({ where: { status: 'closed' as any } }),
      AppDataSource.getRepository(SupportTicket).count({ where: { priority: 'urgent' as any } }),
      AppDataSource.getRepository(SupportTicket).count({ where: { priority: 'high' as any } })
    ]);

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      urgentTickets,
      highPriorityTickets
    };
  }

  // Get ticket categories
  async getTicketCategories() {
    const categories = await AppDataSource.getRepository(SupportTicket)
      .createQueryBuilder('ticket')
      .select('ticket.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ticket.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return categories;
  }

  // Get recent tickets
  async getRecentTickets(limit: number = 10) {
    const tickets = await AppDataSource.getRepository(SupportTicket)
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .orderBy('ticket.created_at', 'DESC')
      .take(limit)
      .getMany();

    return tickets;
  }

  // Close ticket
  async closeTicket(ticketId: string, adminId: string, resolution?: string) {
    const ticket = await AppDataSource.getRepository(SupportTicket).findOne({
      where: { id: ticketId }
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    (ticket as any).status = 'closed';
    ticket.assigned_to = adminId;
    if (resolution) {
      (ticket as any).resolution = resolution;
    }

    await AppDataSource.getRepository(SupportTicket).save(ticket);

    // Create notification for user
    const notification = new Notification();
    notification.user_id = ticket.user_id;
    notification.title = 'Support Ticket Closed';
    notification.message = `Your support ticket "${(ticket as any).subject}" has been closed. ${resolution ? `Resolution: ${resolution}` : ''}`;
    notification.type = 'support';
    await AppDataSource.getRepository(Notification).save(notification);

    return ticket;
  }

  // Get user's ticket history
  async getUserTicketHistory(userId: string, limit: number = 20) {
    const tickets = await AppDataSource.getRepository(SupportTicket)
      .createQueryBuilder('ticket')
      .where('ticket.user_id = :userId', { userId })
      .leftJoinAndSelect('ticket.messages', 'messages')
      .orderBy('ticket.updated_at', 'DESC')
      .take(limit)
      .getMany();

    return tickets;
  }

  // Search tickets
  async searchTickets(params: {
    page?: number;
    limit?: number;
    query: string;
    status?: string;
    priority?: string;
    category?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const queryBuilder = AppDataSource.getRepository(SupportTicket)
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .where(
        '(ticket.subject ILIKE :query OR ticket.description ILIKE :query OR user.username ILIKE :query)',
        { query: `%${params.query}%` }
      )
      .orderBy('ticket.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (params.status) {
      queryBuilder.andWhere('ticket.status = :status', { status: params.status });
    }

    if (params.priority) {
      queryBuilder.andWhere('ticket.priority = :priority', { priority: params.priority });
    }

    if (params.category) {
      queryBuilder.andWhere('ticket.category = :category', { category: params.category });
    }

    const [tickets, total] = await queryBuilder.getManyAndCount();

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

export const supportService = new SupportService();