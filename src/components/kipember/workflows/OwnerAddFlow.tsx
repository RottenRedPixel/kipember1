export default function OwnerAddFlow() {
  return (
    <div className="relative z-[1] pl-4 pr-[22px] pt-1 pb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium pl-1 text-white">ember</span>
        <div
          className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5"
          style={{ background: 'var(--bg-ember-bubble)', border: '1px solid var(--border-ember)' }}
        >
          <p className="text-white/90 text-sm leading-relaxed">
            What would you like to add to this memory? You can record a voice note, add a photo,
            or write something down.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-secondary"
          style={{
            border: '1.5px solid var(--border-btn)',
            background: 'transparent',
            minWidth: 0,
            minHeight: 44,
          }}
          type="button"
        >
          record voice
        </button>
        <button
          className="flex-1 rounded-full text-white text-sm font-medium flex items-center justify-center btn-primary"
          style={{ background: '#f97316', border: 'none', minWidth: 0, minHeight: 44 }}
          type="button"
        >
          add photo
        </button>
      </div>

      <button
        className="w-full rounded-full text-white text-sm font-medium flex items-center justify-center btn-secondary"
        style={{ border: '1.5px solid var(--border-btn)', background: 'transparent', minHeight: 44 }}
        type="button"
      >
        write a note
      </button>
    </div>
  );
}
