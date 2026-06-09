'use client';

import { Button, Card, FieldLabel, PageHeader, SelectField, TextField, ToastProvider, useToast } from '@enagar/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { useTenantAdminSession } from '../../../components/tenant-admin-session';

const ASSET_TYPES = [
  { value: 'HOARDING', label: 'Hoarding' },
  { value: 'MARKET_STALL', label: 'Market Stall' },
  { value: 'LAND', label: 'Land' },
  { value: 'COMMUNITY_HALL_LONG_TERM', label: 'Community Hall (Long Term)' },
  { value: 'OTHER', label: 'Other' },
];

const RATE_PERIODS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

function NewAssetForm() {
  const router = useRouter();
  const { token, apiBase } = useTenantAdminSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    assetType: 'MARKET_STALL',
    nameEn: '',
    locationText: '',
    baseLeaseRateInr: 0,
    ratePeriod: 'MONTHLY',
  });

  const authHeaders = useCallback(
    (): HeadersInit => ({
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    }),
    [token],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nameEn.trim()) {
      toast('Asset name is required.', 'danger');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${apiBase}/rental-assets`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          assetType: formData.assetType,
          name: { en: formData.nameEn.trim() },
          location: { description: formData.locationText.trim() },
          baseLeaseRatePaise: Math.round(formData.baseLeaseRateInr * 100),
          ratePeriod: formData.ratePeriod,
        }),
      });

      if (res.ok) {
        toast('Rental asset created successfully.', 'success');
        router.push('/rental-assets');
      } else {
        const errorData = await res.json().catch(() => ({}));
        const message = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message || 'Failed to create asset.';
        toast(message, 'danger');
      }
    } catch (error) {
      console.error('Error creating asset:', error);
      toast('An unexpected error occurred.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="Create New Rental Asset"
        description="Register a new market stall, hoarding, land parcel, or other long-term rental asset."
      />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <FieldLabel htmlFor="assetType">Asset Type *</FieldLabel>
            <SelectField
              id="assetType"
              required
              value={formData.assetType}
              onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
            >
              {ASSET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="nameEn">Asset Name *</FieldLabel>
            <TextField
              id="nameEn"
              required
              value={formData.nameEn}
              onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
              placeholder="e.g., Stall #12, MG Road Market"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="locationText">Location Description</FieldLabel>
            <TextField
              id="locationText"
              value={formData.locationText}
              onChange={(e) => setFormData({ ...formData, locationText: e.target.value })}
              placeholder="e.g., Near Clock Tower, Ward 4"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="baseLeaseRateInr">Base Lease Rate (INR) *</FieldLabel>
              <TextField
                id="baseLeaseRateInr"
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.baseLeaseRateInr}
                onChange={(e) =>
                  setFormData({ ...formData, baseLeaseRateInr: parseFloat(e.target.value || '0') })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor="ratePeriod">Rate Period *</FieldLabel>
              <SelectField
                id="ratePeriod"
                required
                value={formData.ratePeriod}
                onChange={(e) => setFormData({ ...formData, ratePeriod: e.target.value })}
              >
                {RATE_PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </SelectField>
            </div>
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
              {isSubmitting ? 'Creating Asset...' : 'Create Asset'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function NewAssetPage() {
  return (
    <ToastProvider>
      <NewAssetForm />
    </ToastProvider>
  );
}
