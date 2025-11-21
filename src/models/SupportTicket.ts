import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { TicketStatus, TicketPriority } from '../types';
import { User } from './User';
import { SupportMessage } from './SupportMessage';

@Entity('support_tickets')
@Index(['user_id'])
@Index(['status'])
@Index(['priority'])
@Index(['created_at'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN
  })
  status: TicketStatus;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM
  })
  priority: TicketPriority;

  @Column()
  category: string;

  @Column({ type: 'uuid', nullable: true })
  assigned_to: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, user => user.support_tickets)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => SupportMessage, message => message.ticket)
  messages: SupportMessage[];
}