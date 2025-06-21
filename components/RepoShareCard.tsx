import React, { useRef, useState } from 'react';
import domtoimage from 'dom-to-image-more';
import styles from '../styles/RepoShareCard.module.css';

interface RepoShareCardProps {
  repositoryName: string;
  description: string;
  owner: {
    address: string;
    profile?: {
      nickname?: string;
      profileImageUrl?: string;
    };
  };
  contributors: Array<{
    address: string;
    profile?: {
      nickname?: string;
      profileImageUrl?: string;
    };
  }>;
  lastUpdated: string;
  onClose: () => void;
}

const RepoShareCard: React.FC<RepoShareCardProps> = ({
  repositoryName,
  description,
  owner,
  contributors,
  lastUpdated,
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
      const scale = Math.max(4, pixelRatio * 2);

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
        alert('Repository card copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        // Alternative: Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${repositoryName}_githirys_card.png`;
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
    const ownerIdentifier = owner.profile?.nickname || owner.address;
    const repoUrl = `https://githirys.xyz/${ownerIdentifier}/${repositoryName}`;
    const text = `Check out this awesome repository on GitHirys! 🚀\n\n${repositoryName}\n${description ? `${description}\n\n` : '\n'}${repoUrl}\n\n#GitHirys #Blockchain #OpenSource #Developer`;

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank');
  };

  const getDisplayName = (user: typeof owner) => {
    return (
      user.profile?.nickname ||
      `${user.address.slice(0, 6)}...${user.address.slice(-4)}`
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Repository Share Card</h2>
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
              <div className={styles.repoSection}>
                <h3 className={styles.repoName}>📁 {repositoryName}</h3>
                {description && (
                  <p className={styles.repoDescription}>{description}</p>
                )}
              </div>

              <div className={styles.infoSection}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Owner</span>
                  <div className={styles.userInfo}>
                    {owner.profile?.profileImageUrl && (
                      <img
                        src={owner.profile.profileImageUrl}
                        alt="Owner"
                        className={styles.userAvatar}
                      />
                    )}
                    <span className={styles.userName}>
                      {getDisplayName(owner)}
                    </span>
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Contributors</span>
                  <div className={styles.contributorsInfo}>
                    {contributors.length > 0 ? (
                      <div className={styles.contributorsGrid}>
                        {contributors.slice(0, 3).map((contributor, index) => (
                          <div key={index} className={styles.contributorItem}>
                            {contributor.profile?.profileImageUrl && (
                              <img
                                src={contributor.profile.profileImageUrl}
                                alt="Contributor"
                                className={styles.contributorAvatar}
                              />
                            )}
                            <span className={styles.contributorName}>
                              {getDisplayName(contributor)}
                            </span>
                          </div>
                        ))}
                        {contributors.length > 3 && (
                          <span className={styles.moreContributors}>
                            +{contributors.length - 3} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className={styles.noContributors}>
                        No contributors
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Last Updated</span>
                  <span className={styles.lastUpdated}>{lastUpdated}</span>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className={styles.repoUrl}>
                  githirys.xyz/
                  {owner.profile?.nickname
                    ? owner.profile?.nickname
                    : owner.address.slice(0, 8) + '...'}
                  /{repositoryName}
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

export default RepoShareCard;
