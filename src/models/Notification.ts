import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';

@Entity('notifications')
@Index(['user_id'])
@Index(['is_read'])
@Index(['created_at'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column()
  type: string;

  @Column({ default: false })
  is_read: boolean;

  @Column({ type: 'json', nullable: true })
  data: any;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => User, user => user.notifications)
  @JoinColumn({ name: 'user_id' })
  user: User;
}