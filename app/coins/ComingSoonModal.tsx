import React from "react";

type ComingSoonModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-scaleIn">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>

        {/* Content */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            🚀
          </div>

          <h2 className="text-2xl font-semibold text-gray-900">
            Coming Soon
          </h2>

          <p className="mt-2 text-gray-600">
            This feature is currently under development.
            We’re working hard to launch it soon.
          </p>

          <button
            onClick={onClose}
            className="mt-6 rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComingSoonModal;
