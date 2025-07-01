import { useRouter } from "next/router";
import RepoDetail from "../components/RepoDetail";
import Link from "next/link";

export default function RepoPage() {
    const { repo } = useRouter().query;
    if (typeof repo !== "string") return <p>Invalid path.</p>;

    return (
        <div className="container">
            <Link href="/">← Back</Link>
            <RepoDetail repoName={repo} />
        </div>
    );
} 