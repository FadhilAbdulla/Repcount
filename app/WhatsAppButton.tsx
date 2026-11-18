import "./whatsapp.css";

/** Floating "chat on WhatsApp" button for the public site. Renders nothing until the admin adds a number in Settings. */
export default function WhatsAppButton({number}: {number: string}) {
  if (!/^\d{8,15}$/.test(number)) return null;
  const text = encodeURIComponent("Hi RepCount, I’d like to know more about personal training.");
  return <a className="rc-whatsapp" href={`https://wa.me/${number}?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Chat with RepCount on WhatsApp">
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M16.04 3C9.1 3 3.46 8.63 3.46 15.57c0 2.22.58 4.38 1.68 6.29L3.36 28.5l6.8-1.78a12.53 12.53 0 0 0 5.88 1.49h.01c6.93 0 12.57-5.64 12.57-12.58C28.62 8.63 22.98 3 16.04 3Zm0 23.08h-.01a10.43 10.43 0 0 1-5.32-1.46l-.38-.23-4.03 1.06 1.08-3.93-.25-.4a10.4 10.4 0 0 1-1.6-5.55c0-5.76 4.69-10.45 10.46-10.45 5.76 0 10.45 4.69 10.45 10.46 0 5.76-4.69 10.5-10.4 10.5Zm5.73-7.83c-.31-.16-1.86-.92-2.15-1.02-.29-.11-.5-.16-.71.16-.21.31-.82 1.02-1 1.23-.18.21-.37.24-.68.08-.31-.16-1.33-.49-2.53-1.56-.93-.83-1.56-1.86-1.75-2.17-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.18.21-.31.31-.52.11-.21.05-.39-.03-.55-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.53-.71-.54h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.07-1.1 2.62s1.13 3.04 1.29 3.25c.16.21 2.22 3.39 5.38 4.75.75.32 1.34.52 1.8.66.75.24 1.44.21 1.98.13.6-.09 1.86-.76 2.12-1.5.26-.73.26-1.36.18-1.5-.08-.13-.29-.21-.6-.37Z"/>
    </svg>
  </a>;
}
