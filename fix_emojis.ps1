$file = 'c:\TradeTalk\app\(tabs)\chat\MessageItem.tsx'
$content = [System.IO.File]::ReadAllText($file)

$newBlock = @"
const EMOJI_TABS = [
  { label: "😀", title: "Smileys", emojis: ["😀","😂","🥰","😎","😢","😡","🤔","😮","🤣","😅","😇","🥳","😏","😬","🤯","😴","🥺","😤","🤗","😑","😜","🤪","😒","😳","🫠","🤭","😶","🫡","😈","🤫","🫢","😲"] },
  { label: "👍", title: "Gestures", emojis: ["👍","👎","👏","🙏","🤝","✌️","🤞","👀","💪","🤙","👋","🫶","🤲","🫱","🫳","☝️","👆","👇","👈","👉","🤘","🤟","🖖","✋","🖐️","👌","🤌","🤏","🫰","💅","🫵","🙌"] },
  { label: "❤️", title: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❤️‍🔥","💕","💞","💓","💗","💖","💝","💘","💟","♥️","❣️","🫀","💌","💋","😍","🥰","😘","💑","👫","💏","🌹","💐","🫦"] },
  { label: "🎉", title: "Celebration", emojis: ["🎉","🔥","💯","🎊","🏆","⚡","🌟","💥","🎯","🚀","👑","💎","🏅","🥇","🎖️","🎀","🎁","🪄","✨","🌈","🎆","🎇","🧨","🪅","🎠","🎡","🎢","🎪","🎭","🎬","🎤","🎸"] },
];
const EMOJIS = EMOJI_TABS[0].emojis.slice(0, 7);
"@

$before = $content.Substring(0, 595)
$after = $content.Substring(1511)
$result = $before + $newBlock + $after

[System.IO.File]::WriteAllText($file, $result, [System.Text.Encoding]::UTF8)
Write-Host "Done"
