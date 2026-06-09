'use client';

import {
  Button,
  Card,
  FieldLabel,
  PageHeader,
  SelectField,
  TextField,
  ToastProvider,
  useToast,
} from '@enagar/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { useTenantAdminSession } from '../../../components/tenant-admin-session';

type RentalAsset = {
  id: string;
  assetType: string;
  name: Record<string, string>;
  baseLeaseRatePaise: number;
  ratePeriod: string;
};

function NewLeaseAgreementForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetAssetId = searchParams.get('assetId') ?? '';
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [availableAssets, setAvailableAssets] = useState<RentalAsset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const [formData, setFormData] = useState({
    assetId: presetAssetId,
    tradeLicenseNo: '',
    lessorName: '',
    lessorPhone: '',
    startDate: '',
    endDate: '',
    securityDepositPaise: 0,
    agreementDocumentKey: '',
  });

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await fetch(`${apiBase}/rental-assets?status=AVAILABLE`, {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableAssets(data);
        } else {
          toast('Failed to fetch available assets.', 'danger');
        }
      } catch (error) {
        console.error('Error fetching assets:', error);
        toast('Could not reach the API.', 'danger');
      } finally {
        setIsLoadingAssets(false);
      }
    };

    void fetchAssets();
  }, [apiBase, authHeaders, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tradeLicenseNo.trim()) {
      toast('Trade License Number is mandatory.', 'danger');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/rental-assets/agreements`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...formData,
          startDate: formData.startDate,
          endDate: formData.endDate,
          lessorPhone: formData.lessorPhone.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast('Lease agreement created successfully.', 'success');
        router.push('/rental-assets');
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast(errorData.message || 'Failed to create agreement.', 'danger');
      }
    } catch (error) {
      console.error('Error creating agreement:', error);
      toast('An unexpected error occurred.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Create New Lease Agreement"
        description="Link an available asset to a lessee with a valid trade license."
      />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <FieldLabel htmlFor="assetId">Available Asset *</FieldLabel>
            <SelectField
              id="assetId"
              required
              value={formData.assetId}
              onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
              disabled={isLoadingAssets}
            >
              <option value="">Select an available asset</option>
              {availableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name.en || 'Unnamed'} ({asset.assetType.replace(/_/g, ' ')}) -{' '}
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                    asset.baseLeaseRatePaise / 100,
                  )}
                  /{asset.ratePeriod}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="tradeLicenseNo">Trade License Number *</FieldLabel>
            <TextField
              id="tradeLicenseNo"
              required
              value={formData.tradeLicenseNo}
              onChange={(e) => setFormData({ ...formData, tradeLicenseNo: e.target.value })}
              placeholder="e.g., TL-2023-XYZ"
            />
            <p className="text-sm text-muted-foreground">
              This is a mandatory requirement for all commercial lease agreements.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="lessorName">Lessor Name (Company/Individual) *</FieldLabel>
              <TextField
                id="lessorName"
                required
                value={formData.lessorName}
                onChange={(e) => setFormData({ ...formData, lessorName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="securityDepositPaise">Security Deposit (INR)</FieldLabel>
              <TextField
                id="securityDepositPaise"
                type="number"
                value={formData.securityDepositPaise / 100}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    securityDepositPaise: Math.round(parseFloat(e.target.value || '0') * 100),
                  })
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="lessorPhone">Lessor Phone (for portal access)</FieldLabel>
            <TextField
              id="lessorPhone"
              type="tel"
              value={formData.lessorPhone}
              onChange={(e) => setFormData({ ...formData, lessorPhone: e.target.value })}
              placeholder="e.g., 9876543210"
            />
            <p className="text-sm text-muted-foreground">
              Optional. Enter phone to let the lessor view &amp; pay rent online.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="startDate">Start Date *</FieldLabel>
              <TextField
                id="startDate"
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="endDate">End Date *</FieldLabel>
              <TextField
                id="endDate"
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="agreementDocument">Agreement Document (Copy)</FieldLabel>
            {/* TODO: Integrate existing S3 signed URL upload component here */}
            <TextField
              id="agreementDocument"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled
              title="Document upload integration pending"
            />
            <p className="text-sm text-muted-foreground">
              Note: Document upload functionality will link to the existing S3 signed URL flow.
            </p>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating Agreement...' : 'Create Lease Agreement'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function NewLeaseAgreementPage() {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <NewLeaseAgreementForm />
      </Suspense>
    </ToastProvider>
  );
}
