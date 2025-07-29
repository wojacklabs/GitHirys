import type { NextApiRequest, NextApiResponse } from 'next';
import { getProfileByAddress } from '../../lib/irys';

// 메모리 캐시 구현
const profileCache = new Map<string, { profile: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // GET 메서드만 허용
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  // address 파라미터 검증
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Invalid address parameter' });
  }

  // 솔라나 주소 형식 검증 (32-44자의 Base58 문자열)
  const isValidSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  if (!isValidSolanaAddress) {
    return res.status(400).json({ error: 'Invalid Solana address format' });
  }

  try {
    // 캐시 확인
    const cached = profileCache.get(address);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      // 캐시된 결과 반환
      return res.status(200).json(cached.profile ? 1 : 0);
    }

    // Irys에서 프로필 조회
    let profile = null;
    try {
      profile = await getProfileByAddress(address);
    } catch (irysError) {
      console.error('Irys network error:', irysError);
      // Irys 네트워크 오류 시에도 캐시된 데이터가 있으면 사용
      if (cached) {
        return res.status(200).json(cached.profile ? 1 : 0);
      }
      // 캐시도 없고 Irys도 오류면 0 반환 (챌린지 미완료로 처리)
      return res.status(200).json(0);
    }

    // 캐시 업데이트
    profileCache.set(address, {
      profile: profile,
      timestamp: now,
    });

    // 캐시 크기 관리 (최대 1000개)
    if (profileCache.size > 1000) {
      const oldestKey = profileCache.keys().next().value;
      if (oldestKey) {
        profileCache.delete(oldestKey);
      }
    }

    // 프로필이 있으면 1, 없으면 0 반환
    return res.status(200).json(profile ? 1 : 0);
  } catch (error) {
    console.error('Error in irys-challenge API:', error);
    // 오류 발생 시에도 0 반환 (챌린지 미완료로 처리)
    return res.status(200).json(0);
  }
}
