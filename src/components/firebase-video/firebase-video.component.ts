import { Component, Input, inject, ViewChild, signal, OnInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Storage, ref, getDownloadURL } from '@angular/fire/storage';

@Component({
  selector: 'app-firebase-video',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './firebase-video.component.html',
  styleUrls: ['./firebase-video.component.css'],
})
export class FirebaseVideoComponent implements OnInit {
  private storage = inject(Storage);



  /** Example: "DLP.mp4" (required) */
  @Input({ required: true }) fileName!: string;

  /** Optional: e.g., "videos/" if you place files in a subfolder of the bucket */
  @Input() folder: string = '';

  /** Reactive state using Angular 18 signals */
  isPlaying = signal(false);
  videoUrl = signal<string>('');
  isLoading = signal(true);
  hasError = signal(false);

  /** ViewChild reference to the video element */
  @ViewChild('videoPlayer', { static: false }) videoPlayer!: ElementRef<HTMLVideoElement>;

  readonly posterUrl = '/loanpost/assets/images/DLP_Banner.webp';

  /**
   * Handles play button click and video interaction
   * Uses modern event handling with proper error management
   */
  playVideo(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    // Get video element from ViewChild reference
    const videoElement = this.videoPlayer?.nativeElement;

    if (videoElement) {
      // Use the modern play() promise-based API
      videoElement.play()
        .then(() => {
          this.isPlaying.set(true);
          this.setupVideoEventListeners(videoElement);
        })
        .catch((error) => {
          console.error('Error playing video:', error);
          // Handle autoplay restrictions or other play errors
          this.hasError.set(true);
        });
    }
  }

  /**
   * Sets up event listeners for video state management
   * Follows Angular best practices for event handling
   */
  private setupVideoEventListeners(videoElement: HTMLVideoElement): void {
    // Use arrow functions to maintain 'this' context
    const onPlay = () => this.isPlaying.set(true);
    const onPause = () => this.isPlaying.set(false);
    const onEnded = () => this.isPlaying.set(false);

    // Remove existing listeners to prevent memory leaks
    videoElement.removeEventListener('play', onPlay);
    videoElement.removeEventListener('pause', onPause);
    videoElement.removeEventListener('ended', onEnded);

    // Add fresh event listeners
    videoElement.addEventListener('play', onPlay);
    videoElement.addEventListener('pause', onPause);
    videoElement.addEventListener('ended', onEnded);
  }

  /**
   * Component initialization following Angular lifecycle hooks
   * Uses async/await for clean Firebase Storage integration
   */
  async ngOnInit(): Promise<void> {
    if (!this.fileName) {
      console.error('FirebaseVideoComponent: fileName is required.');
      this.hasError.set(true);
      this.isLoading.set(false);
      return;
    }

    try {
      // Construct Firebase Storage path with optional folder
      const path = `${this.folder}${this.fileName}`;
      const videoRef = ref(this.storage, path);

      // Get download URL using Firebase Storage v9 modular API
      const url = await getDownloadURL(videoRef);

      // Update reactive state using signals
      this.videoUrl.set(url);
      this.isLoading.set(false);
    } catch (error) {
      console.error('Error loading video from Firebase Storage:', error);
      this.hasError.set(true);
      this.isLoading.set(false);
    }
  }
  ngAfterViewInit() {
    const video = document.getElementById('dlp-hero-video') as HTMLVideoElement;
    if (video) {
      const source = document.createElement('source');
      source.src = 'https://firebasestorage.googleapis.com/v0/b/dlp-site-8b8b0.appspot.com/o/dlp_banner_video.mp4?alt=media&token=xxxx';
      source.type = 'video/mp4';
      video.appendChild(source);
      video.load();
    }
  }
}
