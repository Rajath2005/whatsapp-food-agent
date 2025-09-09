const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    // Supabase client
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
    }

    // Google Sheets client
    if (process.env.GOOGLE_SHEETS_API_KEY) {
      this.sheets = google.sheets({
        version: 'v4',
        auth: process.env.GOOGLE_SHEETS_API_KEY
      });
    }

    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  }

  // ==================== INVENTORY METHODS ====================
  
  async getInventory() {
    try {
      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('inventory')
          .select('*')
          .eq('is_available', true);
        
        if (error) throw error;
        return data;
      }
      
      if (this.sheets) {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: 'Inventory!A2:E1000'
        });
        
        return response.data.values?.map(row => ({
          id: parseInt(row[0]),
          name: row[1],
          price: parseFloat(row[2]),
          quantity: parseInt(row[3]),
          is_available: row[4]?.toLowerCase() === 'true'
        })).filter(item => item.is_available) || [];
      }
      
      throw new Error('No database configuration found');
    } catch (error) {
      logger.error('❌ Error fetching inventory:', error);
      throw error;
    }
  }

  async getItemByName(itemName) {
    try {
      const inventory = await this.getInventory();
      return inventory.find(item => 
        item.name.toLowerCase().includes(itemName.toLowerCase())
      );
    } catch (error) {
      logger.error('❌ Error finding item by name:', error);
      throw error;
    }
  }

  async updateInventoryQuantity(itemId, newQuantity) {
    try {
      if (this.supabase) {
        const { error } = await this.supabase
          .from('inventory')
          .update({ 
            quantity: newQuantity,
            is_available: newQuantity > 0
          })
          .eq('id', itemId);
        
        if (error) throw error;
        logger.info(`✅ Updated inventory for item ${itemId}: quantity=${newQuantity}`);
        return true;
      }
      
      // For Google Sheets, you'd need to implement row updates
      logger.warn('⚠️ Google Sheets inventory update not implemented');
      return false;
    } catch (error) {
      logger.error('❌ Error updating inventory:', error);
      throw error;
    }
  }

  // ==================== ORDERS METHODS ====================
  
  async createOrder(orderData) {
    try {
      const order = {
        customer_phone: orderData.customerPhone,
        customer_name: orderData.customerName,
        items: JSON.stringify(orderData.items),
        total_amount: orderData.totalAmount,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('orders')
          .insert([order])
          .select();
        
        if (error) throw error;
        logger.info(`✅ Order created: ${data[0].id}`);
        return data[0];
      }
      
      if (this.sheets) {
        const values = [[
          '', // ID will be auto-generated
          order.customer_phone,
          order.customer_name,
          order.items,
          order.total_amount,
          order.status,
          order.created_at
        ]];
        
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: 'Orders!A:G',
          valueInputOption: 'RAW',
          resource: { values }
        });
        
        logger.info(`✅ Order created in Google Sheets`);
        return { ...order, id: Date.now() }; // Temporary ID
      }
      
      throw new Error('No database configuration found');
    } catch (error) {
      logger.error('❌ Error creating order:', error);
      throw error;
    }
  }

  async getOrdersByPhone(customerPhone) {
    try {
      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('orders')
          .select('*')
          .eq('customer_phone', customerPhone)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
      }
      
      // For Google Sheets implementation
      logger.warn('⚠️ Google Sheets order lookup not implemented');
      return [];
    } catch (error) {
      logger.error('❌ Error fetching orders:', error);
      throw error;
    }
  }

  async getOrderById(orderId) {
    try {
      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();
        
        if (error) throw error;
        return data;
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Error fetching order by ID:', error);
      throw error;
    }
  }

  // ==================== FAQ METHODS ====================
  
  async getFAQs() {
    try {
      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('faqs')
          .select('*')
          .eq('is_active', true);
        
        if (error) throw error;
        return data;
      }
      
      if (this.sheets) {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: 'FAQs!A2:D1000'
        });
        
        return response.data.values?.map(row => ({
          id: parseInt(row[0]),
          question: row[1],
          answer: row[2],
          is_active: row[3]?.toLowerCase() === 'true'
        })).filter(faq => faq.is_active) || [];
      }
      
      throw new Error('No database configuration found');
    } catch (error) {
      logger.error('❌ Error fetching FAQs:', error);
      throw error;
    }
  }

  async searchFAQ(query) {
    try {
      const faqs = await this.getFAQs();
      return faqs.find(faq => 
        faq.question.toLowerCase().includes(query.toLowerCase()) ||
        faq.answer.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      logger.error('❌ Error searching FAQ:', error);
      throw error;
    }
  }
}

const databaseService = new DatabaseService();

async function initializeDatabase() {
  try {
    if (databaseService.supabase) {
      // Test Supabase connection
      const { error } = await databaseService.supabase.from('inventory').select('count').single();
      if (!error) {
        logger.info('✅ Supabase connected successfully');
      }
    } else if (databaseService.sheets) {
      logger.info('✅ Google Sheets configured');
    } else {
      logger.warn('⚠️ No database configuration found');
    }
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
  }
}

module.exports = { databaseService, initializeDatabase };
