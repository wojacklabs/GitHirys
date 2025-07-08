import type { NextPage } from 'next';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useClientWallet } from '../lib/useClientWallet';
import Link from 'next/link';
import Head from 'next/head';
import {
  createIrysUploader,
  getProfileByAddress,
  checkNicknameAvailability,
  uploadProfile,
  ProfileUtils,
  UserProfile,
} from '../lib/irys';
import ProfileCard from '../components/ProfileCard';
import styles from '../styles/ProfilePage.module.css';

const ProfilePage: NextPage = () => {
  const wallet = useClientWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 지갑 관련 상태
  const [publicKey, setPublicKey] = useState('');
  const [uploader, setUploader] = useState<any>(null);

  // 프로필 관련 상태
  const [existingProfile, setExistingProfile] = useState<UserProfile | null>(
    null
  );
  const [nickname, setNickname] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // UI 상태
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState('');

  // 닉네임 검증 상태
  const [nicknameChecking, setNicknameChecking] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(
    null
  );

  // 명함카드 팝업 상태
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [profileCardData, setProfileCardData] = useState<{
    nickname: string;
    walletAddress: string;
    joinDate: string;
    profileImageUrl?: string;
  } | null>(null);
  const [shouldRefreshAfterClose, setShouldRefreshAfterClose] = useState(false);

  // 명함카드 팝업 닫기 핸들러
  const handleCloseProfileCard = () => {
    setShowProfileCard(false);
    if (shouldRefreshAfterClose) {
      setShouldRefreshAfterClose(false);
      setTimeout(() => {
        window.location.reload();
      }, 300); // 팝업 닫힌 후 약간의 지연을 두고 새로고침
    }
  };

  // 지갑 연결 처리
  useEffect(() => {
    if (wallet.connected && wallet.publicKey) {
      setPublicKey(wallet.publicKey.toBase58());
    } else {
      setPublicKey('');
    }
  }, [wallet.connected, wallet.publicKey]);

  // Irys 업로더 초기화
  useEffect(() => {
    const initUploader = async () => {
      if (!wallet || !wallet.connected) {
        setUploader(null);
        return;
      }

      try {
        const newUploader = await createIrysUploader(wallet);
        setUploader(newUploader);
      } catch (error) {
        console.error('Irys 업로더 생성 실패:', error);
        setUploader(null);
      }
    };

    initUploader();
  }, [wallet]);

  // 기존 프로필 로드
  useEffect(() => {
    const loadExistingProfile = async () => {
      if (!publicKey) return;

      setIsLoadingProfile(true);
      try {
        const profile = await getProfileByAddress(publicKey);
        if (profile) {
          setExistingProfile(profile);
          setNickname(profile.nickname);
          setTwitterHandle(profile.twitterHandle);
          if (profile.profileImageUrl) {
            setPreviewUrl(profile.profileImageUrl);
          }
        }
      } catch (error) {
        console.error('프로필 로드 오류:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadExistingProfile();
  }, [publicKey]);

  // 닉네임 중복 검사 (디바운스)
  useEffect(() => {
    if (!nickname || nickname === existingProfile?.nickname) {
      setNicknameAvailable(null);
      return;
    }

    if (!ProfileUtils.isValidNickname(nickname)) {
      setNicknameAvailable(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setNicknameChecking(true);
      try {
        const available = await checkNicknameAvailability(nickname);
        setNicknameAvailable(available);
      } catch (error) {
        console.error('닉네임 중복 검사 오류:', error);
        setNicknameAvailable(false);
      } finally {
        setNicknameChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [nickname, existingProfile]);

  // 파일 선택 처리
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({
        ...prev,
        image: 'Upload only image file.',
      }));
      return;
    }

    // 파일 크기 검증 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        image: 'Image should be smaller than 5MB.',
      }));
      return;
    }

    // No size restriction - any image size is accepted

    setProfileImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setErrors(prev => ({ ...prev, image: '' }));
  };

  // 폼 검증
  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!nickname) {
      newErrors.nickname = 'Nickname missing.';
    } else if (!ProfileUtils.isValidNickname(nickname)) {
      newErrors.nickname =
        'Nickname must be 3-20 characters long and can only contain letters, numbers, and underscores.';
    } else if (
      nickname !== existingProfile?.nickname &&
      nicknameAvailable === false
    ) {
      newErrors.nickname = 'Nickname already exists.';
    }

    if (twitterHandle && !ProfileUtils.isValidTwitterHandle(twitterHandle)) {
      newErrors.twitter =
        'Twitter handle must be 1-15 characters long and can only contain letters, numbers, and underscores.';
    }

    // 프로필 이미지는 선택사항 (기존 프로필이 없고 새 이미지도 없으면 기본 이미지 생성)

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 프로필 저장
  const handleSave = async () => {
    if (!validateForm() || !uploader) return;

    setIsSaving(true);
    setSuccessMessage('');

    try {
      const profileData = {
        nickname,
        twitterHandle,
        accountAddress: publicKey,
        profileImage: profileImage || undefined,
        existingRootTxId: existingProfile?.rootTxId,
        existingProfileImageUrl:
          !profileImage && existingProfile?.profileImageUrl
            ? existingProfile.profileImageUrl
            : undefined,
      };

      const result = await uploadProfile(uploader, profileData);

      if (result.success) {
        setSuccessMessage('Profile Saved!');

        // 명함카드 팝업 데이터 설정
        const joinDate = existingProfile
          ? new Date(existingProfile.timestamp * 1000).toLocaleDateString(
              'en-US'
            )
          : new Date().toLocaleDateString('en-US');

        setProfileCardData({
          nickname,
          walletAddress: publicKey,
          joinDate,
          profileImageUrl: previewUrl || undefined,
        });

        // 명함카드 팝업 표시
        setShowProfileCard(true);
        setShouldRefreshAfterClose(true);
      } else {
        setErrors({ general: result.error || 'Failed to save Profile.' });
      }
    } catch (error) {
      console.error('프로필 저장 오류:', error);
      setErrors({ general: 'Failed to save Profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!wallet.connected) {
    return (
      <>
        <Head>
          <title>Profile - GitHirys</title>
        </Head>
        <div className="container">
          <div className={styles.notConnectedSection}>
            <p className={styles.notConnectedTitle}>
              ⚠️ Connect wallet to create profile
            </p>
            <p>Please connect your wallet using the header button.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Profile - GitHirys</title>
      </Head>
      <div className="container">
        {isLoadingProfile ? (
          <div className={styles.loadingText}>
            <p>Fetching data...</p>
          </div>
        ) : (
          <div className={styles.profile_main}>
            {/* 성공 메시지 */}
            {successMessage && (
              <div className={styles.message_top_success}>
                ✅ {successMessage}
              </div>
            )}

            {/* 일반 오류 메시지 */}
            {errors.general && (
              <div className={styles.message_top_error}>{errors.general}</div>
            )}

            {/* 프로필 이미지 */}
            <div className={styles.area_form}>
              <label className={styles.title_form}>Profile Image</label>
              <div className={styles.area_input_image}>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="프로필 미리보기"
                    className={styles.image}
                  />
                )}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className={styles.imageInput}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={styles.button_image}
                  >
                    Upload image
                  </button>
                  <p className={styles.guide_image}>· 5MB max</p>
                </div>
              </div>
              {errors.image && (
                <p className={styles.error_message}>{errors.image}</p>
              )}
            </div>

            {/* 닉네임 */}
            <div className={styles.area_form}>
              <label className={styles.title_form}>Nickname *</label>
              <div className={styles.area_input_nickname}>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="3-20 english letter, number, underscore"
                  className={`${styles.formInput} ${errors.nickname ? styles.formInputError : styles.formInputNormal}`}
                />
                {nicknameChecking && (
                  <div
                    className={`${styles.inputStatus} ${styles.inputStatusChecking}`}
                  >
                    <span>Checking...</span>
                  </div>
                )}
                {!nicknameChecking &&
                  nickname &&
                  nickname !== existingProfile?.nickname &&
                  nicknameAvailable !== null && (
                    <div
                      className={`${styles.inputStatus} ${nicknameAvailable ? styles.inputStatusAvailable : styles.inputStatusUnavailable}`}
                    >
                      <span>
                        {nicknameAvailable
                          ? '✅ Available'
                          : '❌ Not Available'}
                      </span>
                    </div>
                  )}
              </div>
              {errors.nickname && (
                <p className={styles.error_message}>{errors.nickname}</p>
              )}
              {nickname && (
                <p className={styles.url_example}>
                  Profile URL: <code>githirys.xyz/{nickname}</code>
                </p>
              )}
            </div>
            {/* 트위터 핸들 */}
            <div className={styles.area_form}>
              <label className={styles.title_form}>X Handle (Optional)</label>
              <input
                type="text"
                value={twitterHandle}
                onChange={e => setTwitterHandle(e.target.value)}
                placeholder="@username or username"
                className={`${styles.formInput} ${errors.twitter ? styles.formInputError : styles.formInputNormal}`}
              />
              {errors.twitter && (
                <p className={styles.error_message}>{errors.twitter}</p>
              )}
            </div>

            {/* 저장 버튼 */}
            <div className={styles.area_form}>
              <button
                onClick={handleSave}
                disabled={
                  isSaving ||
                  !uploader ||
                  (nickname !== existingProfile?.nickname &&
                    nicknameAvailable === false)
                }
                className={`${styles.submitButton} ${isSaving ? styles.submitButtonDisabled : styles.submitButtonActive}`}
              >
                {isSaving
                  ? 'Saving...'
                  : existingProfile
                    ? 'Update Profile'
                    : 'Create Profile'}
              </button>
            </div>

            {/* 현재 프로필 정보 */}
            {existingProfile && (
              <div className={styles.currentProfileSection}>
                <h3 className={styles.currentProfileTitle}>Current Profile</h3>
                <p className={styles.currentProfileInfo}>
                  Nickname: <strong>{existingProfile.nickname}</strong>
                </p>
                {existingProfile.twitterHandle && (
                  <p className={styles.currentProfileInfo}>
                    X handle: <strong>@{existingProfile.twitterHandle}</strong>
                  </p>
                )}
                <p className={styles.currentProfileMeta}>
                  Last Update:{' '}
                  {new Date(existingProfile.timestamp * 1000).toLocaleString(
                    'en-US'
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 명함카드 팝업 */}
      {showProfileCard && profileCardData && (
        <ProfileCard
          nickname={profileCardData.nickname}
          walletAddress={profileCardData.walletAddress}
          joinDate={profileCardData.joinDate}
          profileImageUrl={profileCardData.profileImageUrl}
          onClose={handleCloseProfileCard}
        />
      )}
    </>
  );
};

export default ProfilePage;
