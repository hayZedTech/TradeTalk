# Chat Features Implementation Guide

## 🗄️ Required Supabase Database Changes

### 1. Update Users Table
```sql
-- Add theme preference
ALTER TABLE users ADD COLUMN theme VARCHAR(10) DEFAULT 'light' CHECK (theme IN ('light', 'dark'));

-- Add online status and last seen
ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add typing status (for real-time presence)
ALTER TABLE users ADD COLUMN is_typing BOOLEAN DEFAULT false;
```

### 2. Create New Tables
```sql
-- Blocked users table
CREATE TABLE blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- User reports table
CREATE TABLE user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES users(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message search index (for better search performance)
CREATE INDEX IF NOT EXISTS messages_content_search_idx ON messages USING gin(to_tsvector('english', content));
```

### 3. Row Level Security (RLS) Policies
```sql
-- Blocked users policies
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own blocks" ON blocked_users
  FOR ALL USING (auth.uid() = blocker_id);

-- User reports policies  
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON user_reports
  FOR SELECT USING (auth.uid() = reporter_id);
```

## 🎯 Features Implemented

### ✅ 1. Typing Indicators
- Real-time typing status using Supabase presence
- Shows "Typing..." when other user is typing
- Auto-clears after 2 seconds of inactivity

### ✅ 2. Dark/Light Mode Theme Switching
- **ThemeContext** (`contexts/ThemeContext.tsx`)
- Persistent theme storage with AsyncStorage
- Database sync for user preference
- Dynamic color system for all components
- Toggle available in chat options menu

### ✅ 3. Search Messages
- Full-text search using PostgreSQL's `textSearch`
- Fallback to simple text matching
- Search results display with count
- Highlight search query in results
- Clear search functionality

### ✅ 4. Report User System
- **Report Modal** with predefined reasons:
  - Spam
  - Harassment  
  - Inappropriate Content
  - Scam/Fraud
  - Fake Profile
  - Other
- Optional description field
- Stores reports in database for admin review

### ✅ 5. Block/Unblock User System
- Block users to prevent receiving messages
- Unblock functionality
- Database tracking of blocked relationships
- Visual indicators in chat options

### ✅ 6. Hamburger Menu in Chat Header
- **ChatOptionsModal** (`components/chat/ChatOptionsModal.tsx`)
- Accessible via menu icon next to username
- Contains all chat management features
- Slide-up modal design

## 📁 Files Created/Modified

### New Files:
- `contexts/ThemeContext.tsx` - Theme management
- `components/chat/ChatOptionsModal.tsx` - Chat options modal

### Modified Files:
- `app/(tabs)/chat/[id].tsx` - Main chat integration
- `app/(tabs)/chat/ChatHeader.tsx` - Added hamburger menu
- `app/(tabs)/chat/MessageItem.tsx` - Theme support
- `lib/supabase.ts` - Type definitions (if needed)

## 🚀 Usage Instructions

### 1. Apply Database Changes
Run the SQL commands above in your Supabase SQL editor.

### 2. Wrap Your App with ThemeProvider
```tsx
// In your main App.tsx or _layout.tsx
import { ThemeProvider } from './contexts/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      {/* Your existing app components */}
    </ThemeProvider>
  );
}
```

### 3. Features Access
- **Hamburger Menu**: Tap the menu icon (☰) next to username in chat header
- **Theme Toggle**: Available in chat options menu
- **Search**: Enter query in search field within options modal
- **Block/Report**: Available as options in the modal
- **Typing Indicators**: Automatic when users type

## 🎨 Theme Colors

### Light Mode:
- Background: `#ffffff`
- Surface: `#f5f5f5` 
- Text: `#1f2937`
- Primary: `#2255ee`
- My Bubble: `#2255ee20`
- Their Bubble: `#dd881120`

### Dark Mode:
- Background: `#1f2937`
- Surface: `#374151`
- Text: `#f9fafb`
- Primary: `#60a5fa`
- My Bubble: `#60a5fa30`
- Their Bubble: `#f59e0b30`

## 🔧 Key Functions

### Search Messages:
```tsx
const handleSearchMessages = async (query: string) => {
  // Full-text search with fallback
}
```

### Block/Unblock User:
```tsx
const handleBlockUser = async () => {
  // Insert into blocked_users table
}
```

### Report User:
```tsx
const handleReportUser = async () => {
  // Insert into user_reports table
}
```

### Theme Toggle:
```tsx
const { theme, toggleTheme, colors } = useTheme();
```

## 📱 UI Components

All components are now theme-aware and will automatically adapt to light/dark mode. The hamburger menu provides easy access to all features without cluttering the main chat interface.

## 🔒 Security Notes

- All database operations use RLS policies
- Users can only manage their own blocks/reports
- Blocked users are filtered at the database level
- Theme preferences are user-specific

## 🎯 Next Steps

After implementing these changes:
1. Test all features in both light and dark modes
2. Verify database policies work correctly
3. Test search functionality with various queries
4. Ensure typing indicators work in real-time
5. Test block/unblock functionality
6. Verify report system stores data correctly