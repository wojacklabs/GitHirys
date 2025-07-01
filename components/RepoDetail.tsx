// components/RepoDetail.tsx
import { useEffect, useState } from 'react';
import { createIrysUploader } from '../lib/irys';
import JSZip from 'jszip';

export default function RepoDetail({ repoName }: { repoName: string }) {
  const [cid, setCid] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const uploader = await createIrysUploader();
        
        try {
          console.log('Loading repository details:', { repoName, uploader });
          
          // Try to get transaction information from Irys
          try {
            // Handle both CID and regular name cases
            let transactionId = repoName;
            
            // If it's a regular repository name, search for CID
            if (!repoName.startsWith('Qm') && !repoName.startsWith('bafy')) {
              console.log('Searching for CID by repository name:', repoName);
              
              // Note: The search API might be different in the new version
              // This is a placeholder implementation - may need adjustment based on actual API
              try {
                // Search functionality needs to be updated based on new API
                console.log('Search functionality needs to be updated for new Irys API');
                throw new Error(`Repository '${repoName}' not found.`);
              } catch (searchError) {
                throw new Error(`Repository '${repoName}' not found.`);
              }
            }
            
            // Get transaction information
            try {
              // TODO: Update download functionality for new Irys API
              // const data = await uploader.download(transactionId);
              console.log('Download functionality needs to be updated for new Irys API');
              
              setCid(transactionId);
              
              // Try to extract file list from actual data
              try {
                // Placeholder implementation until download API is updated
                const fileList: string[] = [];
                setFiles(fileList);
                console.log(`Found ${fileList.length} files.`);
              } catch (downloadError) {
                console.warn('Failed to extract file list:', downloadError);
                setFiles([]);
              }
            } catch (transactionError) {
              throw new Error('Repository data not found.');
            }
            
          } catch (searchError) {
            console.warn('Repository not found:', searchError);
            setCid('');
            setFiles([]);
          }
        } catch (apiError) {
          console.error('Irys API call failed:', apiError);
          setCid('');
          setFiles([]);
        }
      } catch (error) {
        console.error('Error occurred while loading repository information:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [repoName]);

  const cloneCmd = `igit clone irys://${repoName}`;

  // If repository doesn't exist
  if (!loading && !cid) {
    return (
      <div>
        <h2>{repoName}</h2>
        <div className="error">
          <p>❌ Repository '{repoName}' not found.</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            • Please check if the repository name is correct<br/>
            • Please check if the repository has been uploaded to Irys<br/>
            • Please check if the connected wallet has upload permissions<br/>
            • Note: API functionality is being updated for the new Irys version
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>{repoName}</h2>
      {cid && (
        <>
          <p>CID: <code>{cid}</code></p>
          <p>
            Clone: <code>{cloneCmd}</code>
            <button onClick={() => navigator.clipboard.writeText(cloneCmd)} style={{ marginLeft: 8 }}>
              Copy
            </button>
          </p>
        </>
      )}
      <h3>File List</h3>
      {loading ? (
        <p className="loading">Loading repository information...</p>
      ) : files.length > 0 ? (
        <ul>{files.map(p => <li key={p}>📄 {p}</li>)}</ul>
      ) : cid ? (
        <p>This repository has no files or the file list cannot be read. (API update in progress)</p>
      ) : null}
    </div>
  );
}
