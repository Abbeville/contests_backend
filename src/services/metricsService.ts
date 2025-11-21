import { AppDataSource } from '../config/database';
import { ContestSubmission } from '../models/ContestSubmission';
import { SubmissionMetrics } from '../models/SubmissionMetrics';
import { SocialMediaAccount } from '../models/SocialMediaAccount';
import { SocialMediaPlatform } from '../types';

interface SocialMediaMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

export class MetricsService {
  
  // Fetch and store metrics for a submission
  async fetchAndStoreMetrics(submissionId: string): Promise<SubmissionMetrics | null> {
    try {
      const submission = await AppDataSource.getRepository(ContestSubmission).findOne({
        where: { id: submissionId },
        relations: ['user']
      });

      if (!submission || !submission.post_id || !submission.platform) {
        console.log('Submission missing post_id or platform:', submissionId);
        return null;
      }

      // Get user's social media account for this platform
      const socialAccount = await AppDataSource.getRepository(SocialMediaAccount).findOne({
        where: { 
          user_id: submission.user_id, 
          platform: submission.platform.toLowerCase() as SocialMediaPlatform
        }
      });

      if (!socialAccount) {
        console.log('Social media account not found for user:', submission.user_id, 'platform:', submission.platform);
        return null;
      }

      // Fetch metrics based on platform
      let metrics: SocialMediaMetrics = {
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0
      };
      try {
        switch (submission.platform.toLowerCase()) {
          case 'instagram':
            metrics = await this.fetchInstagramPostMetrics(submission.post_id, socialAccount.access_token);
            break;
          case 'tiktok':
            metrics = await this.fetchTikTokPostMetrics(submission.post_id, socialAccount.access_token);
            break;
          case 'youtube':
            metrics = await this.fetchYouTubePostMetrics(submission.post_id, socialAccount.access_token);
            break;
          case 'facebook':
            metrics = await this.fetchFacebookPostMetrics(submission.post_id, socialAccount.access_token);
            break;
          case 'twitter':
          case 'x':
            metrics = await this.fetchTwitterPostMetrics(submission.post_id, socialAccount.access_token);
            break;
          default:
            console.log('Unsupported platform:', submission.platform);
            return null;
        }
      } catch (error) {
        console.error('Error fetching metrics:', error);
        return null;
      }

      // Calculate engagement score (default weights)
      const engagementScore = this.calculateEngagementScore(metrics, {
        likes: 1,
        comments: 2,
        shares: 3,
        views: 0.5
      });

      // Store metrics in database
      const submissionMetrics = new SubmissionMetrics();
      submissionMetrics.submission_id = submissionId;
      submissionMetrics.likes = metrics.likes || 0;
      submissionMetrics.comments = metrics.comments || 0;
      submissionMetrics.shares = metrics.shares || 0;
      submissionMetrics.views = metrics.views || 0;
      submissionMetrics.engagement_score = engagementScore;
      submissionMetrics.raw_metrics = metrics;
      submissionMetrics.platform = submission.platform;

      const savedMetrics = await AppDataSource.getRepository(SubmissionMetrics).save(submissionMetrics);
      console.log('✅ Metrics stored for submission:', submissionId);
      
      return savedMetrics;
    } catch (error) {
      console.error('Error fetching and storing metrics:', error);
      return null;
    }
  }

  // Fetch metrics for all submissions in a contest
  async fetchContestMetrics(contestId: string): Promise<SubmissionMetrics[]> {
    try {
      const submissions = await AppDataSource.getRepository(ContestSubmission).find({
        where: { contest_id: contestId },
        relations: ['user']
      });

      const metricsPromises = submissions.map(submission => 
        this.fetchAndStoreMetrics(submission.id)
      );

      const results = await Promise.allSettled(metricsPromises);
      const successfulMetrics = results
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => (result as PromiseFulfilledResult<SubmissionMetrics>).value);

      console.log(`✅ Fetched metrics for ${successfulMetrics.length}/${submissions.length} submissions`);
      return successfulMetrics;
    } catch (error) {
      console.error('Error fetching contest metrics:', error);
      return [];
    }
  }

  // Get latest metrics for a submission
  async getLatestMetrics(submissionId: string): Promise<SubmissionMetrics | null> {
    try {
      return await AppDataSource.getRepository(SubmissionMetrics).findOne({
        where: { submission_id: submissionId },
        order: { created_at: 'DESC' }
      });
    } catch (error) {
      console.error('Error getting latest metrics:', error);
      return null;
    }
  }

  // Calculate engagement score based on weights
  private calculateEngagementScore(metrics: SocialMediaMetrics, weights: any): number {
    const likes = metrics.likes || 0;
    const comments = metrics.comments || 0;
    const shares = metrics.shares || 0;
    const views = metrics.views || 0;

    return (likes * weights.likes) + 
           (comments * weights.comments) + 
           (shares * weights.shares) + 
           (views * weights.views);
  }

  // Platform-specific metric fetching methods
  private async fetchInstagramPostMetrics(postId: string, accessToken: string): Promise<SocialMediaMetrics> {
    try {
      const response = await fetch(`https://graph.instagram.com/${postId}?fields=id,media_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${accessToken}`);
      
      if (!response.ok) {
        throw new Error(`Instagram API error: ${response.status}`);
      }
      
      const data: any = await response.json();
      
      return {
        likes: data.like_count || 0,
        comments: data.comments_count || 0,
        shares: 0, // Instagram doesn't provide share count via API
        views: 0 // Instagram doesn't provide view count for posts
      };
    } catch (error) {
      console.error('Instagram metrics error:', error);
      throw error;
    }
  }

  private async fetchTikTokPostMetrics(postId: string, accessToken: string): Promise<SocialMediaMetrics> {
    try {
      const response = await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,title,like_count,comment_count,view_count,share_count', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters: { 
            video_ids: [postId]
          }
        })
      });
      
      const data: any = await response.json();
      
      if (!data.data || !data.data.videos || data.data.videos.length === 0) {
        throw new Error('Video not found');
      }
      
      const video = data.data.videos[0];
      
      return {
        likes: video.like_count || 0,
        comments: video.comment_count || 0,
        shares: video.share_count || 0,
        views: video.view_count || 0
      };
    } catch (error) {
      console.error('TikTok metrics error:', error);
      throw error;
    }
  }

  private async fetchYouTubePostMetrics(postId: string, accessToken: string): Promise<SocialMediaMetrics> {
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${postId}&key=${accessToken}`);
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }
      
      const data: any = await response.json();
      
      if (!data.items || data.items.length === 0) {
        throw new Error('Video not found');
      }
      
      const stats = data.items[0].statistics;
      
      return {
        likes: parseInt(stats.likeCount) || 0,
        comments: parseInt(stats.commentCount) || 0,
        shares: 0, // YouTube doesn't provide share count via API
        views: parseInt(stats.viewCount) || 0
      };
    } catch (error) {
      console.error('YouTube metrics error:', error);
      throw error;
    }
  }

  private async fetchFacebookPostMetrics(postId: string, accessToken: string): Promise<SocialMediaMetrics> {
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${postId}?fields=id,message,created_time,likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`);
      
      if (!response.ok) {
        throw new Error(`Facebook API error: ${response.status}`);
      }
      
      const data: any = await response.json();
      
      return {
        likes: data.likes?.summary?.total_count || 0,
        comments: data.comments?.summary?.total_count || 0,
        shares: data.shares?.count || 0,
        views: 0 // Facebook doesn't provide view count for posts via API
      };
    } catch (error) {
      console.error('Facebook metrics error:', error);
      throw error;
    }
  }

  private async fetchTwitterPostMetrics(postId: string, accessToken: string): Promise<SocialMediaMetrics> {
    try {
      const response = await fetch(`https://api.twitter.com/2/tweets/${postId}?tweet.fields=public_metrics`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }
      
      const data: any = await response.json();
      
      if (!data.data) {
        throw new Error('Tweet not found');
      }
      
      const metrics = data.data.public_metrics;
      
      return {
        likes: metrics.like_count || 0,
        comments: metrics.reply_count || 0,
        shares: metrics.retweet_count || 0,
        views: metrics.impression_count || 0
      };
    } catch (error) {
      console.error('Twitter metrics error:', error);
      throw error;
    }
  }
}

export const metricsService = new MetricsService();
