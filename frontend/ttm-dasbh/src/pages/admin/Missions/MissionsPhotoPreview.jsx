export default function MissionsPhotoPreview({ src, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[9999]">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-gray-700 rounded-full p-2 text-white hover:bg-red-600 transition"
      >
        ✕
      </button>
      <img
        src={src}
        alt="Preview"
        className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-lg"
      />
    </div>
  );
}
