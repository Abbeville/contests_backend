import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './User';
import { Contest } from './Contest';

@Entity('contest_participants')
@Index(['contest_id'])
@Index(['user_id'])
@Index(['joined_at'])
export class ContestParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  contest_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @CreateDateColumn()
  joined_at: Date;

  // Relations
  @ManyToOne(() => Contest, contest => contest.participants)
  @JoinColumn({ name: 'contest_id' })
  contest: Contest;

  @ManyToOne(() => User, user => user.contest_participations)
  @JoinColumn({ name: 'user_id' })
  user: User;
}