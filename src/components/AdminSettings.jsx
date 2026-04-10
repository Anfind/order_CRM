import { useState } from 'react';
import useStore from '../store/useStore';
import { Trash2, Plus, Save, X, Edit, LayoutGrid, Layers, Armchair } from 'lucide-react';

export default function AdminSettings() {
  const tableAreas = useStore(s => s.tableAreas);
  const categories = useStore(s => s.categories);
  const menuItems = useStore(s => s.menuItems);
  const tables = useStore(s => s.tables);
  const addToast = useStore(s => s.addToast);
  const loadFromServer = useStore(s => s.loadFromServer);

  const [activeTab, setActiveTab] = useState('menu'); // menu, categories, areas
  
  const [editingItem, setEditingItem] = useState(null); // The item being edited or new item

  const apiFetch = async (path, method, body) => {
    try {
      const res = await fetch(`/api/data${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error('API Error');
      return true;
    } catch(err) {
      addToast(err.message, 'error');
      return false;
    }
  };

  const saveEntity = async (table) => {
    if (!editingItem.name || (table !== 'tables' && !editingItem.id)) {
      addToast('ID và Tên không được để trống', 'warning');
      return;
    }
    const isNew = !editingItem._isEdit;
    const body = { ...editingItem };
    delete body._isEdit;
    
    let path = `/config/${table}`;
    let method = 'POST';
    if (!isNew) {
      path += `/${editingItem.id}`;
      method = 'PUT';
    }

    const ok = await apiFetch(path, method, body);
    if (ok) {
      addToast('Lưu thành công!', 'success');
      setEditingItem(null);
      loadFromServer();
    }
  };

  const deleteEntity = async (table, id) => {
    if (!window.confirm('Xác nhận xóa?')) return;
    const ok = await apiFetch(`/config/${table}/${id}`, 'DELETE');
    if (ok) {
      addToast('Đã xóa', 'success');
      loadFromServer();
    }
  };

  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      addToast('Chỉ chấp nhận file hình ảnh!', 'error');
      return;
    }
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      addToast('Đang tải ảnh lên...', 'info');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setEditingItem(prev => ({ ...prev, image: data.url }));
      addToast('Tải ảnh thành công!', 'success');
    } catch (err) {
      addToast('Lỗi tải ảnh: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
        <button className={`btn ${activeTab === 'menu' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => {setActiveTab('menu'); setEditingItem(null);}}>
          <Armchair size={16}/> Món Ăn
        </button>
        <button className={`btn ${activeTab === 'categories' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => {setActiveTab('categories'); setEditingItem(null);}}>
          <Layers size={16}/> Danh Mục
        </button>
        <button className={`btn ${activeTab === 'areas' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => {setActiveTab('areas'); setEditingItem(null);}}>
          <LayoutGrid size={16}/> Khu Vực Bàn
        </button>
        <button className={`btn ${activeTab === 'tables' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => {setActiveTab('tables'); setEditingItem(null);}}>
          <Armchair size={16}/> Quản Lý Bàn
        </button>
      </div>

      <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '20px', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3>Quản lý {activeTab === 'menu' ? 'Thực đơn' : activeTab === 'categories' ? 'Danh mục' : activeTab === 'areas' ? 'Khu vực bàn' : 'Bàn cụ thể'}</h3>
          {!editingItem && (
            <button className="btn btn--primary btn--sm" onClick={() => setEditingItem({ id: activeTab === 'tables' ? null : '', name: '', order_idx: 0, _isEdit: false, status: 'empty', guest_count: 0 })}>
              <Plus size={16} /> Thêm Mới
            </button>
          )}
        </div>

        {editingItem ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--color-bg-secondary)', padding: '16px', borderRadius: '8px' }}>
            <h4>{editingItem._isEdit ? 'Chỉnh Sửa' : 'Thêm Mới'}</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {activeTab !== 'tables' && (
                <input type="text" placeholder="ID (vd: c1, A1, bun_rieu)" value={editingItem.id} disabled={editingItem._isEdit} onChange={e => setEditingItem({...editingItem, id: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}/>
              )}
              {activeTab === 'tables' && editingItem._isEdit && (
                <input type="text" value={`ID: ${editingItem.id}`} disabled style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', background: '#eee' }}/>
              )}
              <input type="text" placeholder="Tên hiển thị" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}/>
              
              {activeTab === 'menu' && (
                <>
                  <input type="number" placeholder="Giá" value={editingItem.price || ''} onChange={e => setEditingItem({...editingItem, price: Number(e.target.value)})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}/>
                  <select value={editingItem.category || ''} onChange={e => setEditingItem({...editingItem, category: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="">Chọn danh mục...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  
                  <div style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ minWidth: '100px', fontWeight: 'bold' }}>Ảnh đại diện:</span>
                    {editingItem.image && <img src={editingItem.image} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />}
                    <input type="file" accept="image/*" onChange={uploadImage} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', gridColumn: '1 / -1', cursor: 'pointer', background: 'var(--color-surface)', padding: '12px', borderRadius: '6px', border: '1px dashed #aaa' }}>
                    <input 
                      type="checkbox" 
                      checked={editingItem.no_kitchen === 1} 
                      onChange={e => setEditingItem({...editingItem, no_kitchen: e.target.checked ? 1 : 0})} 
                      style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '600', color: 'var(--color-text)' }}>Không in phiếu ra bếp (dành cho Khăn ướt, Bánh tráng...)</span>
                  </label>
                </>
              )}

              {activeTab === 'tables' && (
                <>
                  <select value={editingItem.area || ''} onChange={e => setEditingItem({...editingItem, area: e.target.value})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="">Chọn khu vực (Bắt buộc)...</option>
                    {tableAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <input type="number" placeholder="Số ghế (Mặc định 4)" value={editingItem.seats || ''} onChange={e => setEditingItem({...editingItem, seats: Number(e.target.value)})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}/>
                </>
              )}

              {activeTab !== 'tables' && (
                <input type="number" placeholder="Vị trí sắp xếp (số)" value={editingItem.order_idx} onChange={e => setEditingItem({...editingItem, order_idx: Number(e.target.value)})} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}/>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button className="btn btn--primary" onClick={() => saveEntity(activeTab === 'categories' ? 'categories' : activeTab === 'menu' ? 'menu_items' : activeTab === 'areas' ? 'table_areas' : 'tables')}><Save size={16}/> Lưu Lại</button>
              <button className="btn btn--secondary" onClick={() => setEditingItem(null)}><X size={16}/> Hủy</button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '10px' }}>ID</th>
                  <th style={{ padding: '10px' }}>Tên</th>
                  {activeTab === 'menu' && <th style={{ padding: '10px' }}>Danh Mục</th>}
                  {activeTab === 'menu' && <th style={{ padding: '10px' }}>Giá</th>}
                  {activeTab === 'tables' && <th style={{ padding: '10px' }}>Khu Vực</th>}
                  {activeTab === 'tables' && <th style={{ padding: '10px' }}>Số Ghế</th>}
                  {activeTab !== 'tables' && <th style={{ padding: '10px' }}>Sắp xếp</th>}
                  <th style={{ padding: '10px' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {(activeTab === 'menu' ? menuItems : activeTab === 'categories' ? categories : activeTab === 'areas' ? tableAreas : tables).map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{item.id}</td>
                    <td style={{ padding: '10px' }}>{item.name}</td>
                    {activeTab === 'menu' && <td style={{ padding: '10px' }}>{categories.find(c => c.id === item.category)?.name || item.category}</td>}
                    {activeTab === 'menu' && <td style={{ padding: '10px' }}>{item.price?.toLocaleString()}đ</td>}
                    {activeTab === 'tables' && <td style={{ padding: '10px' }}>{tableAreas.find(a => a.id === item.area)?.name || item.area}</td>}
                    {activeTab === 'tables' && <td style={{ padding: '10px' }}>{item.seats}</td>}
                    {activeTab !== 'tables' && <td style={{ padding: '10px' }}>{item.order_idx}</td>}
                    <td style={{ padding: '10px', display: 'flex', gap: '8px' }}>
                      <button className="btn btn--sm btn--secondary" onClick={() => setEditingItem({ ...item, _isEdit: true })}><Edit size={14}/></button>
                      <button className="btn btn--sm btn--danger" onClick={() => deleteEntity(activeTab === 'menu' ? 'menu_items' : activeTab === 'categories' ? 'categories' : activeTab === 'areas' ? 'table_areas' : 'tables', item.id)}><Trash2 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
