export default function ProductResolutionDialog({ issues = [], onSelect, onConfirmNew, onClose }) {
  if (!issues.length) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">Không thể xác định sản phẩm</h3>
          <p className="mt-1 text-sm text-slate-500">
            Chọn đúng sản phẩm hiện có hoặc xác nhận đây là sản phẩm mới. Hệ thống sẽ không tự tạo bản ghi khi còn mơ hồ.
          </p>
        </div>
        <div className="space-y-4 p-5">
          {issues.map(issue => (
            <div key={issue.index} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="font-semibold text-slate-900">{issue.source.sourceDescription || 'Chưa có tên sản phẩm'}</div>
              <div className="mt-1 text-xs text-slate-600">
                Mã: {issue.source.productCode || 'Chưa có'} · ĐVT: {issue.source.unit || 'Chưa có'}
              </div>
              {issue.resolution.candidates.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {issue.resolution.candidates.map(candidate => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => onSelect(issue.index, candidate.id)}
                      className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left hover:border-[#1e3a5f]/40 hover:bg-blue-50"
                    >
                      <span className="text-sm font-medium text-slate-800">{candidate.product_name}</span>
                      <span className="shrink-0 text-xs text-slate-500">{candidate.product_code || 'Không mã'} · {candidate.unit || 'Không ĐVT'}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!issue.source.candidateName || !issue.source.unit}
                  onClick={() => onConfirmNew(issue.index)}
                  className="mt-3 rounded-lg border border-[#1e3a5f]/30 bg-white px-3 py-2 text-sm font-semibold text-[#1e3a5f] hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Xác nhận tạo sản phẩm mới
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <span className="text-xs text-slate-500">Sau khi xử lý hết, nhấn Lưu hóa đơn lại.</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
