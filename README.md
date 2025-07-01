# GitHirys - Irys-based Git-like Service

A decentralized Git-like repository service utilizing Solana blockchain and Irys network.

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js 16.8** or higher
- **Solana Wallet** (Phantom, Solflare, etc.)
- Internet connection

### 2. Installation and Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open **http://localhost:3000** in your browser to view the application.

## 📋 Current Features

### ✅ Implemented Features

- **🔗 Solana Wallet Connection**
  - Support for Phantom, Solflare wallets
  - Easy connection through wallet modal UI
  - Connection/disconnection state management

- **📂 Repository Exploration**
  - Search Irys transactions for connected wallet address
  - Display only actually uploaded repositories
  - Clear guidance when no repositories exist

- **📄 Repository Details**
  - Display CID for each repository
  - Generate and copy clone commands
  - Display file list (ZIP file support)

- **🎨 Modern UI**
  - Responsive design
  - Loading state indicators
  - Error messages and guidance

### 🔧 Technical Features

- **Complete Decentralization**: Direct use of Irys network without central server
- **Real-time Search**: Real-time repository search upon wallet connection
- **Type Safety**: Safe code written in TypeScript
- **Error Handling**: Robust handling of network errors and API failures

## 🛠 Tech Stack

### Frontend
- **Next.js 14** - React framework
- **React 18** - UI library
- **TypeScript** - Type safety

### Blockchain
- **Solana** - Main blockchain
- **Solana Wallet Adapter** - Wallet integration
- **Irys SDK** - Distributed storage access

### Utilities
- **JSZip** - ZIP file processing
- **CSS Modules** - Styling

## 📁 Project Structure

```
GitHirys/
├── components/           # React components
│   ├── ConnectWallet.tsx # Wallet connection interface
│   ├── RepoList.tsx      # Repository list display
│   └── RepoDetail.tsx    # Repository detail information
├── lib/                 # Core libraries
│   └── irys.ts          # Irys client configuration
├── pages/               # Next.js routing
│   ├── _app.tsx         # App root (wallet provider setup)
│   ├── index.tsx        # Main page
│   └── [repo].tsx       # Dynamic repository page
├── styles/              # Global styles
│   └── globals.css      # CSS style definitions
└── public/              # Static files
```

## 🎯 How to Use

### Step 1: Connect Wallet
1. Access the application
2. Click **"Connect Solana Wallet"** button
3. Select desired wallet from wallet modal (Phantom, Solflare, etc.)
4. Approve connection in wallet

### Step 2: Explore Repositories
- Repository search starts automatically after wallet connection
- Only displays repositories uploaded to Irys with that wallet
- Shows clear guidance message when no repositories exist

### Step 3: View Repository Details
1. Click repository name
2. Check CID and file list
3. Copy clone command for use

## 📊 Current Status

### ✅ Completed
- Solana wallet integration complete
- Irys SDK integration complete
- Basic UI/UX implementation complete
- Error handling and logging complete

### 🚧 In Development
- Complete Irys API implementation
- Repository upload functionality
- Advanced search filters

### 🔮 Planned Features
- CLI tool similar to Git commands
- Branch and commit history
- Collaboration features

## 🐛 Known Limitations

1. **Repository Search**: Currently supports only basic search
2. **Network**: Only mainnet supported (devnet planned)
3. **File Types**: Primarily ZIP file support

## 🔍 Troubleshooting

### When Wallet Connection Fails
- Check if Solana wallet (Phantom, etc.) is installed
- Ensure wallet extension is activated in browser
- Check error messages in browser console (F12)

### When Repositories Don't Display
- Check if repositories were actually uploaded to Irys with that wallet
- Verify network settings (currently only mainnet supported)
- Check API call status in browser console

### Build Errors
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Type check
npm run lint
```

## 📦 Build and Deploy

### Development Environment
```bash
npm run dev          # Start development server
npm run lint         # Code inspection
```

### Production Build
```bash
npm run build        # Production build
npm start           # Run production server
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push branch: `git push origin feature/amazing-feature`
5. Create Pull Request

## 📄 License

This project is distributed under the MIT License.

## 🌐 Related Links

- [Irys Official Documentation](https://docs.irys.xyz)
- [Solana Official Documentation](https://docs.solana.com)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)

---

**GitHirys** presents a new way of code storage for the Web3 era. 🚀 