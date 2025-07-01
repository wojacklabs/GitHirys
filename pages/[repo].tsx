import { useRouter } from "next/router";
import RepoDetail from "../components/RepoDetail";
import Link from "next/link";

export default function RepoPage() {
    const { repo } = useRouter().query;
    if (typeof repo !== "string") return <p>잘못된 경로입니다.</p>;

    return (
        <div className="container">
            <Link href="/" style={{ 
                textDecoration: 'none', 
                color: '#2563eb',
                fontSize: '14px',
                marginBottom: '16px',
                display: 'inline-block'
            }}>
                ← 메인으로 돌아가기
            </Link>
            <RepoDetail repoName={repo} />
        </div>
    );
} 