'use client';

import React, { useEffect, useState } from 'react';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Eye,
  RefreshCw,
  AlertCircle,
  X,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { adminClient, PaymentReceiptItem } from '../../../../lib/admin-client';

export default function AdminReceiptsPage() {
  const [receipts, setReceipts] = useState<PaymentReceiptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Inspection modal state
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceiptItem | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchReceipts = async () => {
    setIsLoading(true);
    try {
      const res = await adminClient.getReceipts({
        status: statusFilter,
        page,
        limit: 20,
        search: search.trim() || undefined,
      });

      if (res.data) {
        setReceipts(res.data.items);
        setTotal(res.data.meta.total);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReceipts();
  };

  const handleApprove = async (receipt: PaymentReceiptItem) => {
    setActionLoading(true);
    setModalFeedback(null);
    try {
      const res = await adminClient.approveReceipt(receipt.id, adminNotes.trim() || undefined);
      if (res.error) {
        setModalFeedback({ type: 'error', message: res.error });
      } else {
        setModalFeedback({ type: 'success', message: 'Order approved! Workspace has been upgraded.' });
        setTimeout(() => {
          setSelectedReceipt(null);
          setAdminNotes('');
          setModalFeedback(null);
          fetchReceipts();
        }, 1200);
      }
    } catch (err: any) {
      setModalFeedback({ type: 'error', message: err.message || 'Approval failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (receipt: PaymentReceiptItem) => {
    if (!confirm('Are you sure you want to reject this payment receipt?')) return;
    setActionLoading(true);
    setModalFeedback(null);
    try {
      const res = await adminClient.rejectReceipt(receipt.id, adminNotes.trim() || undefined);
      if (res.error) {
        setModalFeedback({ type: 'error', message: res.error });
      } else {
        setModalFeedback({ type: 'success', message: 'Order marked as rejected.' });
        setTimeout(() => {
          setSelectedReceipt(null);
          setAdminNotes('');
          setModalFeedback(null);
          fetchReceipts();
        }, 1200);
      }
    } catch (err: any) {
      setModalFeedback({ type: 'error', message: err.message || 'Rejection failed' });
    } finally {
      setActionLoading(false);
    }
  };

  const filterTabs = [
    { id: 'ALL', label: 'All Orders' },
    { id: 'PENDING', label: 'Pending Review' },
    { id: 'VERIFIED', label: 'Approved / Verified' },
    { id: 'REJECTED', label: 'Rejected' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Bank Receipt & Telebirr Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review manual Ethiopian bank receipts (CBE, Awash, Dashen) and Telebirr transaction screenshots.
          </p>
        </div>

        <button
          onClick={fetchReceipts}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* 2. Filter Pills & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filterTabs.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order code, phone, ref..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </div>

      {/* 3. Receipts Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-xs font-semibold">Loading orders...</span>
          </div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-20 text-slate-400 space-y-2">
            <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              No payment orders found
            </p>
            <p className="text-xs text-slate-400">
              {statusFilter === 'PENDING'
                ? 'All bank receipts have been reviewed!'
                : 'Try adjusting your filters or search keywords.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="py-3.5 px-4">Order Code / Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Workspace</th>
                  <th className="py-3.5 px-4">Plan / Amount</th>
                  <th className="py-3.5 px-4">Method / Ref</th>
                  <th className="py-3.5 px-4">Screenshot</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {receipts.map((r) => {
                  const isPending = r.status === 'PENDING';
                  const isVerified = r.status === 'VERIFIED';
                  const isRejected = r.status === 'REJECTED';

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Order Code & Date */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div>{r.orderCode}</div>
                        <div className="text-[11px] font-sans font-normal text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {r.userName}
                        </div>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400">
                          {r.telegramUsername || (r.telegramId ? `ID: ${r.telegramId}` : r.userEmail || '-')}
                        </div>
                      </td>

                      {/* Workspace */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                          {r.workspaceName}
                        </div>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {r.currentWorkspacePlan}
                        </span>
                      </td>

                      {/* Plan / Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 dark:text-white">
                          {r.amountEtb} ETB
                        </div>
                        <div className="text-[11px] font-bold text-blue-600">
                          {r.planCode} ({r.durationDays} days)
                        </div>
                      </td>

                      {/* Method / Ref */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-[11px] text-slate-700 dark:text-slate-300">
                          {r.paymentMethod}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {r.transactionId || r.telebirrPhone || 'N/A'}
                        </div>
                      </td>

                      {/* Screenshot thumbnail */}
                      <td className="py-3.5 px-4">
                        {r.receiptImageUrl ? (
                          <div
                            onClick={() => {
                              setSelectedReceipt(r);
                              setAdminNotes('');
                              setModalFeedback(null);
                            }}
                            className="w-11 h-11 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all relative group"
                          >
                            <img
                              src={r.receiptImageUrl}
                              alt="Receipt"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No image</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                            <XCircle className="w-3 h-3" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedReceipt(r);
                            setAdminNotes('');
                            setModalFeedback(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Review & Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Inspection & 1-Click Approval Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">
                    Inspect Payment Order: {selectedReceipt.orderCode}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Verified against Ethiopian banking records & Telebirr transactions.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Feedback Alert */}
            {modalFeedback && (
              <div
                className={`mx-6 mt-4 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  modalFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {modalFeedback.type === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{modalFeedback.message}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Screenshot */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Uploaded Bank Receipt Screenshot
                </span>

                {selectedReceipt.receiptImageUrl ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-950 max-h-[380px] flex items-center justify-center">
                    <img
                      src={selectedReceipt.receiptImageUrl}
                      alt="Bank Receipt"
                      className="max-h-[380px] w-auto object-contain cursor-zoom-in"
                      onClick={() => window.open(selectedReceipt.receiptImageUrl, '_blank')}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-8 text-center text-slate-400 text-xs">
                    No image file was attached. Verified via reference ID or SMS matching.
                  </div>
                )}

                {selectedReceipt.receiptImageUrl && (
                  <a
                    href={selectedReceipt.receiptImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    <span>Open high-res screenshot in new tab</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Right Column: Transaction & Customer Details */}
              <div className="space-y-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedReceipt.userName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Telegram:</span>
                    <span className="font-bold text-blue-600">
                      {selectedReceipt.telegramUsername || selectedReceipt.telegramId || 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Workspace:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedReceipt.workspaceName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Plan:</span>
                    <span className="font-bold uppercase text-slate-600 dark:text-slate-300">
                      {selectedReceipt.currentWorkspacePlan}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Plan:</span>
                    <span className="font-black text-blue-600">
                      {selectedReceipt.planCode} ({selectedReceipt.durationDays} Days)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount:</span>
                    <span className="font-black text-slate-900 dark:text-white">
                      {selectedReceipt.amountEtb} ETB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Method:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedReceipt.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tx / Ref ID:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedReceipt.transactionId || 'Not specified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payer Name:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedReceipt.payerName || 'Not specified'}
                    </span>
                  </div>
                </div>

                {/* Admin notes input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Audit Notes / Comments (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="e.g. Verified against CBE statement slip #1002"
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleReject(selectedReceipt)}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Reject Receipt
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleApprove(selectedReceipt)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Activate Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
