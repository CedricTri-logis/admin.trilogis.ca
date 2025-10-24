#!/usr/bin/env node

/**
 * QuickBooks CDC (Change Data Capture) Incremental Sync
 * 
 * This script synchronizes changes from QuickBooks using the CDC API
 * Automatically finds where to start based on previous syncs or existing data
 * 
 * Usage:
 *   node sync-cdc-incremental.js                    # Run sync for all companies
 *   node sync-cdc-incremental.js --realm 9130348... # Sync specific company
 *   node sync-cdc-incremental.js --dry-run          # Test without making changes
 *   node sync-cdc-incremental.js --verbose          # Show detailed output
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load .env (Railway injects env vars automatically, this is for local dev)
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'quickbooks' },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

class CDCIncrementalSync {
  constructor(options = {}) {
    this.baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
    
    // Options
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.specificRealm = options.realm || null;
    this.verify = options.verify || false;
    
    // Entity types to sync
    this.entityTypes = [
      // Core entities
      'CompanyInfo',
      'Customer',
      'Vendor',
      'Account',
      'Class',
      'Department',
      'Item',
      'Employee',
      'TaxCode',
      'TaxRate',

      // Transaction entities
      'Invoice',
      'Bill',
      'Payment',
      'BillPayment',
      'CreditMemo',
      'Deposit',
      'JournalEntry',
      'Purchase',
      'SalesReceipt',
      'TimeActivity',
      'Transfer',
      'VendorCredit'
    ];
    
    // Stats for current sync
    this.syncStats = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    };
  }

  log(message, level = 'info') {
    if (level === 'debug' && !this.verbose) return;

    const prefix = {
      'error': '❌',
      'success': '✅',
      'info': '📊',
      'debug': '🔍',
      'warning': '⚠️'
    }[level] || '📌';

    console.log(`${prefix} ${message}`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest(url, token, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Accept': 'application/json'
          },
          timeout: 60000
        });
        return response.data;
      } catch (error) {
        if (error.response?.status === 401 && i < retries - 1) {
          this.log('Token expired, refreshing...', 'warning');
          await this.refreshToken(token);
          continue;
        }
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  async refreshToken(token) {
    try {
      const response = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token
        }), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')}`
        }
      });

      const newTokenData = response.data;
      
      if (!this.dryRun) {
        await supabase
          .from('qb_auth_tokens')
          .update({
            access_token: newTokenData.access_token,
            refresh_token: newTokenData.refresh_token,
            expires_at: new Date(Date.now() + (newTokenData.expires_in * 1000)).toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('realm_id', token.realm_id);
      }

      token.access_token = newTokenData.access_token;
      token.refresh_token = newTokenData.refresh_token;
      
      this.log('Token refreshed successfully', 'success');
      return true;
    } catch (error) {
      this.log(`Token refresh failed: ${error.message}`, 'error');
      return false;
    }
  }

  async findSyncStartPoint(realmId) {
    // 1. Check if we have a previous successful CDC sync
    const { data: lastSync, error: syncError } = await supabase
      .rpc('get_last_cdc_sync', { p_realm_id: realmId });

    if (syncError) {
      this.log(`Error checking last sync: ${syncError.message}`, 'debug');
    }

    if (lastSync) {
      this.log(`Found previous CDC sync: ${lastSync}`, 'debug');
      return new Date(lastSync);
    }

    // 2. No previous CDC sync - find the latest updated_at across all tables
    this.log('No previous CDC sync found, checking latest updates in tables...', 'info');

    const { data: latestUpdate, error: updateError } = await supabase
      .rpc('get_latest_update_time', { p_realm_id: realmId });

    if (updateError) {
      this.log(`Error getting latest update: ${updateError.message}`, 'debug');
    }
    
    if (latestUpdate) {
      this.log(`Latest update found: ${latestUpdate}`, 'debug');
    }
    
    // 3. CDC has a 30-day limit
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const startPoint = latestUpdate ? new Date(latestUpdate) : thirtyDaysAgo;
    
    // Use the more recent date (can't go back more than 30 days)
    const finalStartPoint = startPoint > thirtyDaysAgo ? startPoint : thirtyDaysAgo;
    
    this.log(`Starting CDC from: ${finalStartPoint.toISOString()}`, 'info');
    return finalStartPoint;
  }

  prepareEntityData(entity, entityType, realmId) {
    // Reuse the same preparation functions from the import script
    const baseData = {
      realm_id: realmId,
      qb_id: entity.Id,
      sync_token: entity.SyncToken,
      created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
      updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString(),
      is_deleted: false
    };

    switch (entityType) {
      case 'Customer':
        return {
          ...baseData,
          display_name: entity.DisplayName || 'Unknown',
          given_name: entity.GivenName || null,
          family_name: entity.FamilyName || null,
          company_name: entity.CompanyName || null,
          primary_email_addr: entity.PrimaryEmailAddr?.Address || null,
          primary_phone: entity.PrimaryPhone?.FreeFormNumber || null,
          mobile_phone: entity.MobilePhone?.FreeFormNumber || null,
          billing_addr: entity.BillAddr || null,
          shipping_addr: entity.ShipAddr || null,
          notes: entity.Notes || null,
          taxable: entity.Taxable || true,
          balance: parseFloat(entity.Balance || 0),
          currency_ref: entity.CurrencyRef || null,
          preferred_delivery_method: entity.PreferredDeliveryMethod || null,
          is_active: entity.Active !== false,
          metadata: entity.CustomField || null,
          // Customer hierarchy fields
          parent_ref: entity.ParentRef || null,
          parent_qb_id: entity.ParentRef?.value || null,
          parent_name: entity.ParentRef?.name || null,
          is_job: entity.Job || false,
          balance_with_jobs: parseFloat(entity.BalanceWithJobs || 0),
          fully_qualified_name: entity.FullyQualifiedName || entity.DisplayName,
          level: entity.Level || 0
        };

      case 'Vendor':
        return {
          ...baseData,
          display_name: entity.DisplayName || 'Unknown',
          given_name: entity.GivenName || null,
          middle_name: entity.MiddleName || null,
          family_name: entity.FamilyName || null,
          company_name: entity.CompanyName || null,
          primary_email_addr: entity.PrimaryEmailAddr?.Address || null,
          web_addr: entity.WebAddr?.URI || null,
          primary_phone: entity.PrimaryPhone?.FreeFormNumber || null,
          mobile_phone: entity.MobilePhone?.FreeFormNumber || null,
          fax_phone: entity.FaxPhone?.FreeFormNumber || null,
          billing_addr: entity.BillAddr || null,
          other_addr: entity.OtherAddr || null,
          tax_identifier: entity.TaxIdentifier || null,
          acct_num: entity.AcctNum || null,
          vendor_1099: entity.Vendor1099 || false,
          currency_ref: entity.CurrencyRef || null,
          billing_rate: entity.BillingRate || null,
          balance: parseFloat(entity.Balance || 0),
          is_active: entity.Active !== false,
          metadata: entity.CustomField || null
        };

      case 'Invoice':
        return {
          ...baseData,
          doc_number: entity.DocNumber || null,
          txn_date: entity.TxnDate,
          due_date: entity.DueDate || null,
          customer_ref: entity.CustomerRef || null,
          customer_qb_id: entity.CustomerRef?.value || '0',
          bill_addr: entity.BillAddr || null,
          ship_addr: entity.ShipAddr || null,
          class_ref: entity.ClassRef || null,
          sales_term_ref: entity.SalesTermRef || null,
          total_amt: parseFloat(entity.TotalAmt || 0),
          home_total_amt: parseFloat(entity.HomeTotalAmt || entity.TotalAmt || 0),
          apply_tax_after_discount: entity.ApplyTaxAfterDiscount || false,
          print_status: entity.PrintStatus || null,
          email_status: entity.EmailStatus || null,
          balance: parseFloat(entity.Balance || 0),
          deposit: parseFloat(entity.Deposit || 0),
          customer_memo: entity.CustomerMemo?.value || null,
          private_note: entity.PrivateNote || null,
          metadata: entity.CustomField || null,
          currency_ref: entity.CurrencyRef || null,
          exchange_rate: parseFloat(entity.ExchangeRate || 1),
          home_balance: parseFloat(entity.HomeBalance || entity.Balance || 0),
          line_items: entity.Line || null,
          linked_txn: entity.LinkedTxn || null,
          customer_name: entity.CustomerRef?.name || null,
          total_amount: parseFloat(entity.TotalAmt || 0),
          raw_data: entity
        };

      case 'Bill':
        return {
          ...baseData,
          doc_number: entity.DocNumber || null,
          txn_date: entity.TxnDate,
          due_date: entity.DueDate || null,
          vendor_ref: entity.VendorRef || null,
          vendor_qb_id: entity.VendorRef?.value || null,
          ap_account_ref: entity.APAccountRef || null,
          class_ref: entity.ClassRef || null,
          sales_term_ref: entity.SalesTermRef || null,
          total_amt: parseFloat(entity.TotalAmt || 0),
          home_total_amt: parseFloat(entity.HomeTotalAmt || entity.TotalAmt || 0),
          balance: parseFloat(entity.Balance || 0),
          memo: entity.PrivateNote || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'Payment':
        return {
          ...baseData,
          txn_date: entity.TxnDate,
          customer_ref: entity.CustomerRef || null,
          customer_qb_id: entity.CustomerRef?.value || null,
          customer_name: entity.CustomerRef?.name || null,
          ar_account_ref: entity.ARAccountRef || null,
          deposit_to_account_ref: entity.DepositToAccountRef || null,
          deposit_to_account_id: entity.DepositToAccountRef?.value || null,
          payment_method_ref: entity.PaymentMethodRef || null,
          payment_method_id: entity.PaymentMethodRef?.value || null,
          payment_ref_num: entity.PaymentRefNum || null,
          total_amt: parseFloat(entity.TotalAmt || 0),
          total_amount: parseFloat(entity.TotalAmt || 0),
          unapplied_amt: parseFloat(entity.UnappliedAmt || 0),
          unapplied_amount: parseFloat(entity.UnappliedAmt || 0),
          process_payment: entity.ProcessPayment || false,
          currency_ref: entity.CurrencyRef || null,
          currency_code: entity.CurrencyRef?.value || 'CAD',
          exchange_rate: parseFloat(entity.ExchangeRate || 1),
          private_note: entity.PrivateNote || null,
          metadata: entity.CustomField || null,
          line_items: entity.Line || null,
          linked_txn: entity.LinkedTxn || null,
          txn_source: entity.TxnSource || null,
          raw_data: entity
        };

      case 'BillPayment':
        return {
          ...baseData,
          txn_date: entity.TxnDate,
          vendor_id: entity.VendorRef?.value || null,
          vendor_name: entity.VendorRef?.name || null,
          total_amount: parseFloat(entity.TotalAmt || 0),
          currency_code: entity.CurrencyRef?.value || 'CAD',
          payment_type: entity.PaymentType || null,
          check_number: entity.CheckPayment?.CheckNum || null,
          private_note: entity.PrivateNote || null,
          raw_data: entity
        };

      case 'CompanyInfo':
        // Convert month name to number (1-12)
        const monthMap = {
          'January': 1, 'February': 2, 'March': 3, 'April': 4,
          'May': 5, 'June': 6, 'July': 7, 'August': 8,
          'September': 9, 'October': 10, 'November': 11, 'December': 12
        };

        let fiscalMonth = null;
        if (entity.FiscalYearStartMonth) {
          if (typeof entity.FiscalYearStartMonth === 'string') {
            fiscalMonth = monthMap[entity.FiscalYearStartMonth] || null;
          } else {
            fiscalMonth = parseInt(entity.FiscalYearStartMonth) || null;
          }
        }

        return {
          ...baseData,
          company_name: entity.CompanyName || 'Unknown',
          legal_name: entity.LegalName || null,
          company_addr: entity.CompanyAddr || null,
          customer_communication_addr: entity.CustomerCommunicationAddr || null,
          legal_addr: entity.LegalAddr || null,
          primary_phone: entity.PrimaryPhone?.FreeFormNumber || null,
          company_email: entity.Email?.Address || null,
          web_addr: entity.WebAddr?.URI || null,
          fiscal_year_start_month: fiscalMonth,
          country: entity.Country || null,
          supported_languages: entity.SupportedLanguages || null,
          metadata: entity.CustomField || null
        };

      case 'Account':
        return {
          ...baseData,
          name: entity.Name || 'Unknown',
          account_type: entity.AccountType,
          account_sub_type: entity.AccountSubType || null,
          classification: entity.Classification || null,
          acct_num: entity.AcctNum || null,
          description: entity.Description || null,
          fully_qualified_name: entity.FullyQualifiedName || null,
          active: entity.Active !== false,
          parent_ref: entity.ParentRef || null,
          current_balance: parseFloat(entity.CurrentBalance || 0),
          current_balance_with_sub_accounts: parseFloat(entity.CurrentBalanceWithSubAccounts || 0),
          currency_ref: entity.CurrencyRef || null,
          tax_code_ref: entity.TaxCodeRef || null,
          metadata: entity.CustomField || null
        };

      case 'Class':
        return {
          ...baseData,
          name: entity.Name || 'Unknown',
          fully_qualified_name: entity.FullyQualifiedName || null,
          active: entity.Active !== false,
          parent_ref: entity.ParentRef || null,
          sub_class: entity.SubClass || false,
          parent_id: entity.ParentRef?.value || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'Department':
        return {
          ...baseData,
          name: entity.Name || 'Unknown',
          fully_qualified_name: entity.FullyQualifiedName || null,
          active: entity.Active !== false,
          parent_ref: entity.ParentRef || null,
          sub_department: entity.SubDepartment || false,
          parent_id: entity.ParentRef?.value || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'Item':
        return {
          ...baseData,
          name: entity.Name || 'Unknown',
          sku: entity.Sku || null,
          type: entity.Type,
          active: entity.Active !== false,
          fully_qualified_name: entity.FullyQualifiedName || null,
          taxable: entity.Taxable || false,
          unit_price: parseFloat(entity.UnitPrice || 0),
          purchase_cost: parseFloat(entity.PurchaseCost || 0),
          description: entity.Description || null,
          purchase_desc: entity.PurchaseDesc || null,
          qty_on_hand: parseFloat(entity.QtyOnHand || 0),
          inv_start_date: entity.InvStartDate || null,
          income_account_ref: entity.IncomeAccountRef || null,
          expense_account_ref: entity.ExpenseAccountRef || null,
          asset_account_ref: entity.AssetAccountRef || null,
          track_qty_on_hand: entity.TrackQtyOnHand || false,
          parent_ref: entity.ParentRef || null,
          metadata: entity.CustomField || null
        };

      case 'Employee':
        return {
          ...baseData,
          display_name: entity.DisplayName || 'Unknown',
          given_name: entity.GivenName || null,
          middle_name: entity.MiddleName || null,
          family_name: entity.FamilyName || null,
          primary_email_addr: entity.PrimaryEmailAddr?.Address || null,
          primary_email: entity.PrimaryEmailAddr?.Address || null,
          primary_phone: entity.PrimaryPhone?.FreeFormNumber || null,
          mobile_phone: entity.Mobile?.FreeFormNumber || null,
          primary_addr: entity.PrimaryAddr || null,
          employee_number: entity.EmployeeNumber || null,
          ssn: entity.SSN || null,
          birth_date: entity.BirthDate || null,
          gender: entity.Gender || null,
          hired_date: entity.HiredDate || null,
          released_date: entity.ReleasedDate || null,
          billable_time: entity.BillableTime || false,
          bill_rate: parseFloat(entity.BillRate || 0),
          active: entity.Active !== false,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'CreditMemo':
        return {
          ...baseData,
          doc_number: entity.DocNumber || null,
          txn_date: entity.TxnDate,
          customer_ref: entity.CustomerRef || null,
          customer_qb_id: entity.CustomerRef?.value || null,
          customer_name: entity.CustomerRef?.name || null,
          total_amt: parseFloat(entity.TotalAmt || 0),
          balance: parseFloat(entity.Balance || 0),
          remaining_credit: parseFloat(entity.RemainingCredit || 0),
          bill_addr: entity.BillAddr || null,
          ship_addr: entity.ShipAddr || null,
          customer_memo: entity.CustomerMemo?.value || null,
          currency_ref: entity.CurrencyRef || null,
          currency_code: entity.CurrencyRef?.value || 'CAD',
          exchange_rate: parseFloat(entity.ExchangeRate || 1),
          line_items: entity.Line || null,
          email_status: entity.EmailStatus || null,
          print_status: entity.PrintStatus || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'Deposit':
        return {
          ...baseData,
          txn_date: entity.TxnDate,
          deposit_to_account_ref: entity.DepositToAccountRef || null,
          deposit_to_account_id: entity.DepositToAccountRef?.value || null,
          deposit_to_account_name: entity.DepositToAccountRef?.name || null,
          class_ref: entity.ClassRef || null,
          total_amt: parseFloat(entity.TotalAmt || 0),
          total_amount: parseFloat(entity.TotalAmt || 0),
          home_total_amt: parseFloat(entity.HomeTotalAmt || entity.TotalAmt || 0),
          private_note: entity.PrivateNote || null,
          currency_code: entity.CurrencyRef?.value || 'CAD',
          exchange_rate: parseFloat(entity.ExchangeRate || 1),
          txn_source: entity.TxnSource || null,
          line: entity.Line || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'JournalEntry':
        return {
          ...baseData,
          doc_number: entity.DocNumber || null,
          txn_date: entity.TxnDate,
          adjustment: entity.Adjustment || false,
          total_amt: parseFloat(entity.TotalAmt || 0),
          total_amount: parseFloat(entity.TotalAmt || 0),
          home_total_amt: parseFloat(entity.HomeTotalAmt || entity.TotalAmt || 0),
          private_note: entity.PrivateNote || null,
          currency_code: entity.CurrencyRef?.value || 'CAD',
          exchange_rate: parseFloat(entity.ExchangeRate || 1),
          tax_applicable_on: entity.TaxApplicableOn || null,
          txn_tax_detail: entity.TxnTaxDetail || null,
          line: entity.Line || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'Purchase':
        return {
          ...baseData,
          doc_number: entity.DocNumber || null,
          txn_date: entity.TxnDate,
          account_ref: entity.AccountRef || null,
          account_id: entity.AccountRef?.value || null,
          account_name: entity.AccountRef?.name || null,
          vendor_ref: entity.VendorRef || null,
          entity_ref: entity.EntityRef || null,
          entity_id: entity.EntityRef?.value || null,
          entity_name: entity.EntityRef?.name || null,
          entity_type: entity.EntityRef?.type || null,
          payment_method_ref: entity.PaymentMethodRef || null,
          payment_type: entity.PaymentType || null,
          total_amt: parseFloat(entity.TotalAmt || 0),
          total_amount: parseFloat(entity.TotalAmt || 0),
          currency_ref: entity.CurrencyRef || null,
          currency_code: entity.CurrencyRef?.value || 'CAD',
          exchange_rate: parseFloat(entity.ExchangeRate || 1),
          credit: entity.Credit || false,
          txn_source: entity.TxnSource || null,
          private_note: entity.PrivateNote || null,
          line_items: entity.Line || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'SalesReceipt':
        return {
          ...baseData,
          doc_number: entity.DocNumber || null,
          txn_date: entity.TxnDate,
          customer_ref: entity.CustomerRef || null,
          customer_qb_id: entity.CustomerRef?.value || null,
          customer_id: entity.CustomerRef?.value || null,
          customer_name: entity.CustomerRef?.name || null,
          deposit_to_account_ref: entity.DepositToAccountRef || null,
          deposit_to_account_id: entity.DepositToAccountRef?.value || null,
          payment_method_ref: entity.PaymentMethodRef || null,
          payment_method_id: entity.PaymentMethodRef?.value || null,
          payment_ref_num: entity.PaymentRefNum || null,
          total_amt: parseFloat(entity.TotalAmt || 0),
          total_amount: parseFloat(entity.TotalAmt || 0),
          balance: parseFloat(entity.Balance || 0),
          currency_ref: entity.CurrencyRef || null,
          currency_code: entity.CurrencyRef?.value || 'CAD',
          exchange_rate: parseFloat(entity.ExchangeRate || 1),
          bill_addr: entity.BillAddr || null,
          ship_addr: entity.ShipAddr || null,
          private_note: entity.PrivateNote || null,
          customer_memo: entity.CustomerMemo?.value || null,
          email_status: entity.EmailStatus || null,
          print_status: entity.PrintStatus || null,
          line_items: entity.Line || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'TimeActivity':
        return {
          ...baseData,
          txn_date: entity.TxnDate,
          name_of: entity.NameOf || null,
          employee_ref: entity.EmployeeRef || null,
          employee_id: entity.EmployeeRef?.value || null,
          vendor_ref: entity.VendorRef || null,
          vendor_id: entity.VendorRef?.value || null,
          customer_ref: entity.CustomerRef || null,
          customer_id: entity.CustomerRef?.value || null,
          item_ref: entity.ItemRef || null,
          item_id: entity.ItemRef?.value || null,
          class_ref: entity.ClassRef || null,
          class_id: entity.ClassRef?.value || null,
          department_ref: entity.DepartmentRef || null,
          department_id: entity.DepartmentRef?.value || null,
          pay_type: entity.PayType || null,
          hourly_rate: parseFloat(entity.HourlyRate || 0),
          hours: entity.Hours || 0,
          minutes: entity.Minutes || 0,
          break_hours: entity.BreakHours || 0,
          break_minutes: entity.BreakMinutes || 0,
          start_time: entity.StartTime || null,
          end_time: entity.EndTime || null,
          description: entity.Description || null,
          billable_status: entity.BillableStatus || null,
          taxable: entity.Taxable || false,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      case 'Transfer':
        return {
          ...baseData,
          txn_date: entity.TxnDate,
          from_account_ref: entity.FromAccountRef || null,
          to_account_ref: entity.ToAccountRef || null,
          amount: parseFloat(entity.Amount || 0),
          class_ref: entity.ClassRef || null,
          private_note: entity.PrivateNote || null,
          metadata: entity.CustomField || null
        };

      case 'VendorCredit':
        return {
          ...baseData,
          doc_number: entity.DocNumber || null,
          txn_date: entity.TxnDate,
          vendor_ref: entity.VendorRef || null,
          vendor_qb_id: entity.VendorRef?.value || null,
          vendor_name: entity.VendorRef?.name || null,
          total_amt: parseFloat(entity.TotalAmt || 0),
          balance: parseFloat(entity.Balance || 0),
          currency_ref: entity.CurrencyRef || null,
          currency_code: entity.CurrencyRef?.value || 'CAD',
          exchange_rate: parseFloat(entity.ExchangeRate || 1),
          line_items: entity.Line || null,
          metadata: entity.CustomField || null,
          raw_data: entity
        };

      default:
        return baseData;
    }
  }

  getTableName(entityType) {
    const mapping = {
      'CompanyInfo': 'qb_companies',
      'Customer': 'qb_customers',
      'Vendor': 'qb_vendors',
      'Account': 'qb_accounts',
      'Class': 'qb_classes',
      'Department': 'qb_departments',
      'Item': 'qb_items',
      'Employee': 'qb_employees',
      'TaxCode': 'qb_tax_codes',
      'TaxRate': 'qb_tax_rates',
      'Invoice': 'qb_invoices',
      'Bill': 'qb_bills',
      'Payment': 'qb_payments',
      'BillPayment': 'qb_bill_payments',
      'CreditMemo': 'qb_credit_memos',
      'Deposit': 'qb_deposits',
      'JournalEntry': 'qb_journal_entries',
      'Purchase': 'qb_purchases',
      'SalesReceipt': 'qb_sales_receipts',
      'TimeActivity': 'qb_time_activities',
      'Transfer': 'qb_transfers',
      'VendorCredit': 'qb_vendor_credits'
    };
    return mapping[entityType] || null;
  }

  async processChanges(cdcResponse, token) {
    const entitiesSynced = [];
    
    // CDC response has an array of QueryResponse objects, one for each entity type
    if (!cdcResponse.QueryResponse || !Array.isArray(cdcResponse.QueryResponse)) {
      this.log('No QueryResponse array found', 'debug');
      return entitiesSynced;
    }
    
    // Process each QueryResponse object
    for (const queryResponse of cdcResponse.QueryResponse) {
      for (const entityType of this.entityTypes) {
        const entities = queryResponse[entityType];
        
        if (entities && entities.length > 0) {
          entitiesSynced.push(entityType);
          this.log(`Processing ${entities.length} ${entityType} changes...`, 'info');
          
          const tableName = this.getTableName(entityType);
          
          for (const entity of entities) {
            // Check if this is a deletion (QuickBooks returns deletions with status: "Deleted")
            if (entity.status === 'Deleted') {
              // Handle deletion
              if (!this.dryRun) {
                // Log deletion before removing
                await supabase
                  .from('qb_deletion_log')
                  .upsert({
                    realm_id: token.realm_id,
                    entity_type: entityType,
                    qb_id: entity.Id,
                    deleted_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString()
                  }, { onConflict: 'realm_id,entity_type,qb_id' });

                // Delete the record
                const { error } = await supabase
                  .from(tableName)
                  .delete()
                  .eq('realm_id', token.realm_id)
                  .eq('qb_id', entity.Id);

                if (!error) {
                  this.syncStats.deleted++;
                  this.log(`Deleted ${entityType} ${entity.Id}`, 'debug');
                } else {
                  this.syncStats.errors++;
                  this.log(`Failed to delete ${entityType} ${entity.Id}: ${error.message}`, 'error');
                }
              } else {
                this.log(`[DRY RUN] Would delete ${entityType} ${entity.Id}`, 'debug');
              }
            } else {
              // Handle create/update
              const data = this.prepareEntityData(entity, entityType, token.realm_id);
              
              if (!this.dryRun) {
                // Check if exists
                const { data: existing } = await supabase
                  .from(tableName)
                  .select('id')
                  .eq('realm_id', token.realm_id)
                  .eq('qb_id', entity.Id)
                  .single();
                
                if (existing) {
                  // Update
                  const { error } = await supabase
                    .from(tableName)
                    .update(data)
                    .eq('realm_id', token.realm_id)
                    .eq('qb_id', entity.Id);
                  
                  if (!error) {
                    this.syncStats.updated++;
                    this.log(`Updated ${entityType} ${entity.Id}`, 'debug');
                  } else {
                    this.syncStats.errors++;
                    this.log(`Failed to update ${entityType} ${entity.Id}: ${error.message}`, 'error');
                  }
                } else {
                  // Insert
                  const { error } = await supabase
                    .from(tableName)
                    .insert(data);
                  
                  if (!error) {
                    this.syncStats.created++;
                    this.log(`Created ${entityType} ${entity.Id}`, 'debug');
                  } else {
                    this.syncStats.errors++;
                    this.log(`Failed to create ${entityType} ${entity.Id}: ${error.message}`, 'error');
                  }
                }
              } else {
                this.log(`[DRY RUN] Would upsert ${entityType} ${entity.Id}`, 'debug');
              }
            }
          }
        }
      }
    }
    
    return entitiesSynced;
  }

  async processDeletions(cdcResponse, token) {
    const deletionTypes = [
      { deleted: 'DeletedCustomer', entity: 'Customer', table: 'qb_customers' },
      { deleted: 'DeletedVendor', entity: 'Vendor', table: 'qb_vendors' },
      { deleted: 'DeletedAccount', entity: 'Account', table: 'qb_accounts' },
      { deleted: 'DeletedClass', entity: 'Class', table: 'qb_classes' },
      { deleted: 'DeletedDepartment', entity: 'Department', table: 'qb_departments' },
      { deleted: 'DeletedItem', entity: 'Item', table: 'qb_items' },
      { deleted: 'DeletedEmployee', entity: 'Employee', table: 'qb_employees' },
      { deleted: 'DeletedInvoice', entity: 'Invoice', table: 'qb_invoices' },
      { deleted: 'DeletedBill', entity: 'Bill', table: 'qb_bills' },
      { deleted: 'DeletedPayment', entity: 'Payment', table: 'qb_payments' },
      { deleted: 'DeletedBillPayment', entity: 'BillPayment', table: 'qb_bill_payments' },
      { deleted: 'DeletedCreditMemo', entity: 'CreditMemo', table: 'qb_credit_memos' },
      { deleted: 'DeletedDeposit', entity: 'Deposit', table: 'qb_deposits' },
      { deleted: 'DeletedJournalEntry', entity: 'JournalEntry', table: 'qb_journal_entries' },
      { deleted: 'DeletedPurchase', entity: 'Purchase', table: 'qb_purchases' },
      { deleted: 'DeletedSalesReceipt', entity: 'SalesReceipt', table: 'qb_sales_receipts' },
      { deleted: 'DeletedTimeActivity', entity: 'TimeActivity', table: 'qb_time_activities' },
      { deleted: 'DeletedTransfer', entity: 'Transfer', table: 'qb_transfers' },
      { deleted: 'DeletedVendorCredit', entity: 'VendorCredit', table: 'qb_vendor_credits' }
    ];
    
    for (const type of deletionTypes) {
      const deletedEntities = cdcResponse[type.deleted];
      
      if (deletedEntities && deletedEntities.length > 0) {
        this.log(`Processing ${deletedEntities.length} deleted ${type.entity} records...`, 'info');
        
        for (const deleted of deletedEntities) {
          if (!this.dryRun) {
            // Log deletion before removing
            await supabase
              .from('qb_deletion_log')
              .upsert({
                realm_id: token.realm_id,
                entity_type: type.entity,
                qb_id: deleted.Id,
                deleted_at: deleted.DeletedTime || new Date().toISOString()
              }, { onConflict: 'realm_id,entity_type,qb_id' });

            // Delete the record
            const { error } = await supabase
              .from(type.table)
              .delete()
              .eq('realm_id', token.realm_id)
              .eq('qb_id', deleted.Id);

            if (!error) {
              this.syncStats.deleted++;
              this.log(`Deleted ${type.entity} ${deleted.Id}`, 'debug');
            } else {
              this.syncStats.errors++;
              this.log(`Failed to delete ${type.entity} ${deleted.Id}: ${error.message}`, 'error');
            }
          } else {
            this.log(`[DRY RUN] Would delete ${type.entity} ${deleted.Id}`, 'debug');
          }
        }
      }
    }
  }

  async syncCompany(token) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🏢 CDC Sync for: ${token.company_name}`);
    console.log(`   Realm ID: ${token.realm_id}`);
    console.log(`${'='.repeat(80)}`);
    
    const syncStartTime = new Date();
    const startPoint = await this.findSyncStartPoint(token.realm_id);
    
    // Create sync log entry
    let syncLogId = null;
    if (!this.dryRun) {
      const { data: syncLog, error } = await supabase
        .from('qb_cdc_sync_log')
        .insert({
          realm_id: token.realm_id,
          sync_started_at: syncStartTime,
          changed_since: startPoint,
          last_sync_checkpoint: syncStartTime, // Will update at the end
          status: 'in_progress'
        })
        .select()
        .single();
      
      if (syncLog) {
        syncLogId = syncLog.id;
      }
    }
    
    try {
      // Build CDC URL with all entity types
      const entities = this.entityTypes.join(',');
      const formattedDate = startPoint.toISOString();
      const cdcUrl = `${this.baseUrl}/v3/company/${token.realm_id}/cdc?entities=${entities}&changedSince=${formattedDate}`;
      
      this.log(`CDC URL: ${cdcUrl}`, 'debug');
      
      // Fetch changes
      const response = await this.makeRequest(cdcUrl, token);
      
      if (!response || !response.CDCResponse || response.CDCResponse.length === 0) {
        this.log('No changes found', 'info');

        // Update sync log as successful with no changes
        if (syncLogId && !this.dryRun) {
          await supabase
            .from('qb_cdc_sync_log')
            .update({
              sync_completed_at: new Date(),
              last_sync_checkpoint: new Date(), // Store current time as checkpoint
              status: 'success',
              total_changes: 0,
              sync_duration_seconds: Math.floor((new Date() - syncStartTime) / 1000)
            })
            .eq('id', syncLogId);
        }
        return { entitiesModified: [] };
      }
      
      const cdcData = response.CDCResponse[0];
      
      // Log what we received
      this.log(`CDC Response structure: ${JSON.stringify(Object.keys(cdcData))}`, 'debug');
      if (cdcData.QueryResponse) {
        for (const qr of cdcData.QueryResponse) {
          const entities = Object.keys(qr);
          this.log(`QueryResponse contains: ${entities.join(', ')}`, 'debug');
          for (const entityType of entities) {
            if (Array.isArray(qr[entityType])) {
              this.log(`  ${entityType}: ${qr[entityType].length} items`, 'debug');
            }
          }
        }
      }
      
      // Process changes
      const entitiesSynced = await this.processChanges(cdcData, token);
      
      // Deletions are now handled inline in processChanges when status === 'Deleted'
      
      // Update sync log
      if (syncLogId && !this.dryRun) {
        await supabase
          .from('qb_cdc_sync_log')
          .update({
            sync_completed_at: new Date(),
            last_sync_checkpoint: new Date(), // Store current time as checkpoint
            entities_synced: entitiesSynced,
            records_created: this.syncStats.created,
            records_updated: this.syncStats.updated,
            records_deleted: this.syncStats.deleted,
            total_changes: this.syncStats.created + this.syncStats.updated + this.syncStats.deleted,
            status: 'success',
            sync_duration_seconds: Math.floor((new Date() - syncStartTime) / 1000)
          })
          .eq('id', syncLogId);
      }
      
      // Summary
      console.log(`\n📊 Sync Summary:`);
      console.log(`   Created: ${this.syncStats.created}`);
      console.log(`   Updated: ${this.syncStats.updated}`);
      console.log(`   Deleted: ${this.syncStats.deleted}`);
      console.log(`   Errors: ${this.syncStats.errors}`);
      console.log(`   Duration: ${Math.floor((new Date() - syncStartTime) / 1000)}s`);

      // Return entities that were modified for verification
      return { entitiesModified: entitiesSynced };

    } catch (error) {
      this.log(`Sync failed: ${error.message}`, 'error');
      
      // Update sync log as failed
      if (syncLogId && !this.dryRun) {
        await supabase
          .from('qb_cdc_sync_log')
          .update({
            sync_completed_at: new Date(),
            status: 'failed',
            error_message: error.message,
            sync_duration_seconds: Math.floor((new Date() - syncStartTime) / 1000)
          })
          .eq('id', syncLogId);
      }
      
      throw error;
    }
  }

  async verifyEntityCounts(token) {
    console.log('\n✅ VERIFICATION - QuickBooks vs Database');
    console.log('─'.repeat(70));

    const entityTableMap = {
      'CompanyInfo': 'qb_companies',
      'Customer': 'qb_customers',
      'Vendor': 'qb_vendors',
      'Account': 'qb_accounts',
      'Class': 'qb_classes',
      'Department': 'qb_departments',
      'Item': 'qb_items',
      'Employee': 'qb_employees',
      'Invoice': 'qb_invoices',
      'Bill': 'qb_bills',
      'Payment': 'qb_payments',
      'BillPayment': 'qb_bill_payments',
      'CreditMemo': 'qb_credit_memos',
      'Deposit': 'qb_deposits',
      'JournalEntry': 'qb_journal_entries',
      'Purchase': 'qb_purchases',
      'SalesReceipt': 'qb_sales_receipts',
      'TimeActivity': 'qb_time_activities',
      'Transfer': 'qb_transfers',
      'VendorCredit': 'qb_vendor_credits'
    };

    console.log('\nEntity'.padEnd(20) + 'QuickBooks'.padStart(12) + ' │' + 'Database'.padStart(12) + ' │' + 'Status'.padStart(15));
    console.log('─'.repeat(20) + '┼' + '─'.repeat(13) + '┼' + '─'.repeat(13) + '┼' + '─'.repeat(15));

    let matchCount = 0;
    let totalChecked = 0;

    for (const [entityType, tableName] of Object.entries(entityTableMap)) {
      // Get QuickBooks count via API
      let qbCount = 0;
      let qbError = null;

      if (entityType === 'CompanyInfo') {
        // CompanyInfo is special - always 1 record per company
        qbCount = 1;
      } else {
        const qbQuery = `SELECT COUNT(*) FROM ${entityType}`;
        const qbUrl = `${this.baseUrl}/v3/company/${token.realm_id}/query?query=${encodeURIComponent(qbQuery)}&minorversion=65`;

        try {
          const qbResponse = await this.makeRequest(qbUrl, token);
          qbCount = qbResponse?.QueryResponse?.totalCount || 0;
        } catch (error) {
          this.log(`Error querying QB for ${entityType}: ${error.message}`, 'debug');
          qbError = error;
        }
      }

      // If we couldn't get QB count, skip to error line
      if (qbError) {
        totalChecked++;
        console.log(
          entityType.padEnd(20) +
          'Error'.padStart(12) + ' │' +
          '-'.padStart(12) + ' │' +
          '⚠️ Error'.padStart(15)
        );
        continue;
      }

      // Get Database count (active records only)
      let dbQuery = supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .eq('realm_id', token.realm_id);

      // For most tables, filter by is_deleted
      // CompanyInfo doesn't have is_deleted field
      if (entityType !== 'CompanyInfo') {
        dbQuery = dbQuery.eq('is_deleted', false);
      }

      let dbCount = 0;
      try {
        const result = await dbQuery;
        dbCount = result.count || 0;
      } catch (error) {
        this.log(`Error querying DB for ${entityType}: ${error.message}`, 'debug');
        totalChecked++;
        console.log(
          entityType.padEnd(20) +
          'Error'.padStart(12) + ' │' +
          '-'.padStart(12) + ' │' +
          '⚠️ Error'.padStart(15)
        );
        continue;
      }

      const match = qbCount === dbCount;
      const status = match ? '✅ Match' : '❌ Mismatch';

      if (match) matchCount++;
      totalChecked++;

      console.log(
        entityType.padEnd(20) +
        qbCount.toString().padStart(12) + ' │' +
        dbCount.toString().padStart(12) + ' │' +
        status.padStart(15)
      );

      // Add small delay to avoid rate limits
      await this.sleep(100);
    }

    console.log('─'.repeat(70));
    console.log(`\n📊 Verification Summary: ${matchCount}/${totalChecked} entities match`);

    if (matchCount === totalChecked) {
      console.log('🎉 Perfect! All entities match QuickBooks exactly!');
    } else {
      console.log(`⚠️ ${totalChecked - matchCount} entities have mismatches`);
    }
  }

  async run() {
    console.log('🔄 QUICKBOOKS CDC INCREMENTAL SYNC');
    console.log('=' .repeat(80));
    if (this.dryRun) console.log('🧪 DRY RUN MODE - No changes will be made');
    if (this.verbose) console.log('🔍 VERBOSE MODE - Detailed output enabled');
    if (this.verify) console.log('✅ VERIFY MODE - Show counts after sync');
    console.log('=' .repeat(80));

    // Get tokens
    let tokenQuery = supabase
      .from('qb_auth_tokens')
      .select('*')
      .eq('is_active', true);

    if (this.specificRealm) {
      tokenQuery = tokenQuery.eq('realm_id', this.specificRealm);
    }

    const { data: tokens, error } = await tokenQuery;

    if (error || !tokens || tokens.length === 0) {
      this.log('No active tokens found', 'error');
      return;
    }

    this.log(`Found ${tokens.length} active company token(s)`, 'info');

    const allEntitiesModified = [];

    for (const token of tokens) {
      // Reset stats for each company
      this.syncStats = {
        created: 0,
        updated: 0,
        deleted: 0,
        errors: 0
      };

      let entitiesModified = [];

      try {
        const result = await this.syncCompany(token);
        entitiesModified = result?.entitiesModified || [];

        // Verify if requested
        if (this.verify) {
          await this.verifyEntityCounts(token);
        }
      } catch (error) {
        this.log(`Failed to sync ${token.company_name}: ${error.message}`, 'error');
      }

      allEntitiesModified.push(...entitiesModified);
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('✅ CDC Sync Complete!');
    console.log('=' .repeat(80));
  }
}

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    verbose: false,
    realm: null,
    verify: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--verify':
        options.verify = true;
        break;
      case '--realm':
        if (args[i + 1]) {
          options.realm = args[i + 1];
          i++;
        }
        break;
      case '--help':
      case '-h':
        console.log(`
QuickBooks CDC Incremental Sync

Usage:
  node sync-cdc-incremental.js [options]

Options:
  --dry-run            Test mode - no changes will be made
  --verbose, -v        Show detailed output
  --verify             Show database record counts after sync
  --realm REALM_ID     Sync only specific company
  --help, -h           Show this help message

Examples:
  Run sync for all companies:
    node sync-cdc-incremental.js

  Run sync with verification:
    node sync-cdc-incremental.js --verify

  Test sync without making changes:
    node sync-cdc-incremental.js --dry-run --verbose

  Sync specific company with verification:
    node sync-cdc-incremental.js --realm 9130348651845276 --verify

How it works:
  1. First run: Finds the latest updated_at from your existing data
  2. Subsequent runs: Uses the last successful CDC sync timestamp
  3. Syncs all changes (creates, updates, deletes) since that point
  4. Maximum lookback is 30 days (QuickBooks CDC limit)
        `);
        process.exit(0);
    }
  }
  
  return options;
}

// Main execution
const options = parseArguments();
const syncer = new CDCIncrementalSync(options);

syncer.run().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});