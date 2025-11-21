import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';
import { SupportTicket } from './SupportTicket';

@Entity('support_messages')
@Index(['ticket_id'])
@Index(['sender_id'])
@Index(['created_at'])
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @Column({ type: 'uuid' })
  sender_id: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  is_admin: boolean;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => SupportTicket, ticket => ticket.messages)
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;

  @ManyToOne(() => User, user => user.support_tickets)
  @JoinColumn({ name: 'sender_id' })
  sender: User;
}