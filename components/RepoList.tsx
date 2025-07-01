// components/RepoList.tsx
import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface Repo { name: string; cid: string; }

export default function RepoList({
  uploader,
  owner,
}: {
  uploader: any; // New Irys uploader type
  owner: string;
}) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRepos = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Attempting to load repository list:', { owner });
        
        // Try to call actual Irys API
        try {
          console.log('Searching repositories with Irys uploader:', { owner, uploader });
          
          // Try to search transactions through Irys API
          try {
            // Note: Search API might be different in the new version
            // This is a placeholder implementation - needs to be updated based on actual new API
            console.log('Search functionality needs to be updated for new Irys API');
            
            // For now, set empty results until we can implement the new search API
            const foundRepos: Repo[] = [];
            setRepos(foundRepos);
            console.log(`Found ${foundRepos.length} repositories.`);
            
          } catch (searchError) {
            console.warn('Irys search failed - treating as no repositories:', searchError);
            setRepos([]);
          }
        } catch (apiError) {
          console.error('Irys API connection failed:', apiError);
          setRepos([]);
        }
      } catch (error) {
        console.error('Repository list loading error:', error);
        setError('Failed to load repository list.');
      } finally {
        setLoading(false);
      }
    };

    if (owner && uploader) {
      loadRepos();
    }
  }, [uploader, owner]);

  if (loading) {
    return <p className="loading">Loading repository list...</p>;
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  if (!repos.length) {
    return (
      <div>
        <p>📂 No repositories found in the connected wallet.</p>
        <div style={{ 
          fontSize: '14px', 
          color: '#6b7280', 
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>Reasons for no repositories:</p>
          <p style={{ margin: '4px 0' }}>• No repositories have been uploaded to Irys with this wallet yet</p>
          <p style={{ margin: '4px 0' }}>• Repositories may exist on a different network (devnet/mainnet)</p>
          <p style={{ margin: '4px 0' }}>• Try uploading your first repository using the Irys CLI</p>
          <p style={{ margin: '4px 0' }}>• Note: Search functionality is being updated for the new Irys API</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3>My Repositories ({repos.length})</h3>
      <ul>
        {repos.map(r => (
          <li key={r.name}>
            📁 <Link href={`/${r.name}`}>{r.name}</Link>{' '}
            <code>cid: {r.cid}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
