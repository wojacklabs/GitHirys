import React, { useRef, useState } from 'react';
import domtoimage from 'dom-to-image-more';
import styles from '../styles/ProfileCard.module.css';

interface ProfileCardProps {
  nickname: string;
  walletAddress: string;
  joinDate: string;
  profileImageUrl?: string;
  onClose: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({
  nickname,
  walletAddress,
  joinDate,
  profileImageUrl,
  onClose,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const copyToClipboard = async () => {
    if (!cardRef.current) return;

    setIsCapturing(true);
    try {
      // Get device pixel ratio for better quality
      const pixelRatio = window.devicePixelRatio || 1;
      const scale = Math.max(3, pixelRatio * 2);

      const dataUrl = await domtoimage.toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: scale,
        width: cardRef.current.offsetWidth * scale,
        height: cardRef.current.offsetHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: cardRef.current.offsetWidth + 'px',
          height: cardRef.current.offsetHeight + 'px',
        },
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        alert('Profile card copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        // Alternative: Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${nickname}_githirys_card.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      alert('Failed to generate image.');
    } finally {
      setIsCapturing(false);
    }
  };

  const shareOnTwitter = () => {
    const profileUrl = `https://githirys.xyz/${nickname}`;
    const text = `Check out my profile on GitHirys! 🚀\n\nI've joined GitHirys, a blockchain-based repository platform for developers.\n\n${profileUrl}\n\n#GitHirys #Blockchain #Developer`;

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Profile Card</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.cardContainer}>
          <div className={styles.card} ref={cardRef}>
            <div className={styles.cardHeader}>
              <div className={styles.logoSection}>
                <img
                  src="/sprite_favicon.webp"
                  alt="GitHirys Logo"
                  className={styles.logo}
                />
                <span className={styles.brandName}>GitHirys</span>
              </div>
            </div>

            <div className={styles.cardContent}>
              <div className={styles.profileSection}>
                {profileImageUrl && (
                  <img
                    src={profileImageUrl}
                    alt="Profile Image"
                    className={styles.profileImage}
                  />
                )}
                <div className={styles.profileInfo}>
                  <h3 className={styles.nickname}>{nickname}</h3>
                  <p className={styles.walletAddress}>
                    {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                  </p>
                </div>
              </div>

              <div className={styles.joinDate}>
                <span className={styles.joinDateLabel}>Member since</span>
                <span className={styles.joinDateValue}>{joinDate}</span>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.profileUrl}>
                  githirys.xyz/{nickname}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.buttonContainer}>
          <button
            className={styles.copyButton}
            onClick={copyToClipboard}
            disabled={isCapturing}
          >
            {isCapturing ? 'Generating...' : 'Copy as Image'}
          </button>

          <button className={styles.shareButton} onClick={shareOnTwitter}>
            Share on Twitter
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
