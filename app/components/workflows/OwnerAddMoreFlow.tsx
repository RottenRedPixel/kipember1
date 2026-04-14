export default function OwnerAddMoreFlow() {
  return (
    <div className="relative z-[1] pl-4 pr-[22px] pt-1 pb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold pl-1 text-white">ember</span>
        <div
          className="inline-block max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-2.5"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <p className="text-white/90 text-sm leading-relaxed">
            Welcome back! Would you like to add more to this memory? You can record a voice note, add a photo, or write something down.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          className="flex-1 py-3 rounded-full text-white text-sm font-bold"
          style={{ border: "1.5px solid rgba(255,255,255,0.35)", background: "transparent", minWidth: 0, cursor: "pointer" }}
        >
          record voice
        </button>
        <button
          className="flex-1 py-3 rounded-full text-white text-sm font-bold"
          style={{ background: "#f97316", border: "none", minWidth: 0, cursor: "pointer" }}
        >
          add photo
        </button>
      </div>

      <button
        className="w-full py-3 rounded-full text-white text-sm font-bold"
        style={{ border: "1.5px solid rgba(255,255,255,0.35)", background: "transparent", cursor: "pointer" }}
      >
        write a note
      </button>
    </div>
  );
}
