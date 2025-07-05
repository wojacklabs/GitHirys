// ts-node에서 CommonJS 환경에서 실행하기 위해 require 사용
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  updateRepositoryPermissions,
  updateRepositoryVisibility
} = require('./lib/irys');

interface FakeUploader {
  address: string;
  uploadFile: (data: any, opts?: any) => Promise<{ id: string }>;
}

function createFakeUploader(address: string): FakeUploader {
  return {
    address,
    uploadFile: async () => {
      // 업로드를 실제로 호출하지 않고 더미 ID 반환
      return { id: 'dummyTx_' + Math.random().toString(36).substring(2) };
    }
  };
}

async function runTests() {
  const owner = 'OWNER_WALLET_1111';
  const attacker = 'ATTACKER_WALLET_2222';

  const ownerUploader = createFakeUploader(owner);
  const attackerUploader = createFakeUploader(attacker);

  const permsData = {
    repository: 'sample-repo',
    owner,
    contributors: [owner],
  } as const;

  const visData = {
    repository: 'sample-repo',
    owner,
    visibility: 'private' as const,
  } as const;

  console.log('===== 권한 업데이트: 소유자 시도 =====');
  console.log(await updateRepositoryPermissions(ownerUploader, permsData));

  console.log('\n===== 권한 업데이트: 공격자 시도 =====');
  console.log(await updateRepositoryPermissions(attackerUploader, permsData));

  console.log('\n===== 노출 권한 업데이트: 소유자 시도 =====');
  console.log(await updateRepositoryVisibility(ownerUploader, visData));

  console.log('\n===== 노출 권한 업데이트: 공격자 시도 =====');
  console.log(await updateRepositoryVisibility(attackerUploader, visData));
}

runTests().catch(console.error); 