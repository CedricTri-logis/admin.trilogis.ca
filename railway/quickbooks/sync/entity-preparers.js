/**
 * Entity Preparers for QuickBooks CDC Sync
 * Transforms QuickBooks entity data into database-ready format
 */

function prepareEntityData(entity, entityType, realmId) {
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
        private_note: entity.PrivateNote || null,
        currency_ref: entity.CurrencyRef || null,
        exchange_rate: parseFloat(entity.ExchangeRate || 1),
        home_balance: parseFloat(entity.HomeBalance || entity.Balance || 0),
        line_items: entity.Line || null,
        linked_txn: entity.LinkedTxn || null,
        currency_code: entity.CurrencyRef?.value || 'CAD',
        vendor_name: entity.VendorRef?.name || null,
        total_amount: parseFloat(entity.TotalAmt || 0),
        txn_source: entity.TxnSource || null,
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

    case 'TaxCode':
      return {
        ...baseData,
        name: entity.Name || 'Unknown',
        description: entity.Description || null,
        active: entity.Active !== false,
        taxable: entity.Taxable !== false,
        tax_group: entity.TaxGroup || false,
        hidden: entity.Hidden || false,
        purchase_tax_rate_list: entity.PurchaseTaxRateList || null,
        sales_tax_rate_list: entity.SalesTaxRateList || null,
        tax_code_config_type: entity.TaxCodeConfigType || null,
        metadata: entity.CustomField || null
      };

    case 'TaxRate':
      return {
        ...baseData,
        name: entity.Name || 'Unknown',
        description: entity.Description || null,
        active: entity.Active !== false,
        rate_value: parseFloat(entity.RateValue || 0),
        tax_return_line_ref: entity.TaxReturnLineRef || null,
        agency_ref: entity.AgencyRef || null,
        special_tax_type: entity.SpecialTaxType || null,
        display_type: entity.DisplayType || null,
        effective_tax_rate: entity.EffectiveTaxRate || null,
        metadata: entity.CustomField || null
      };

    default:
      return baseData;
  }
}

function getTableName(entityType) {
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

module.exports = {
  prepareEntityData,
  getTableName
};
