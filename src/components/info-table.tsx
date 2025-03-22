"use client";
import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getExpandedRowModel,
} from '@tanstack/react-table';

interface RowData {
  id: string;
  label: string;
  value: number;
  children?: RowData[];
  originalValue?: number;
  variance?: number;
  depth?: number;
  _inputValue?: string;
}

const initialData: RowData[] = [
  {
    id: "electronics",
    label: "Electronics",
    value: 1500,
    originalValue: 1500,
    children: [
      {
        id: "phones",
        label: "Phones",
        value: 800,
        originalValue: 800,
      },
      {
        id: "laptops",
        label: "Laptops",
        value: 700,
        originalValue: 700,
      },
    ],
  },
  {
    id: "furniture",
    label: "Furniture",
    value: 1000,
    originalValue: 1000,
    children: [
      {
        id: "tables",
        label: "Tables",
        value: 300,
        originalValue: 300,
      },
      {
        id: "chairs",
        label: "Chairs",
        value: 700,
        originalValue: 700,
      },
    ],
  },
];

const EditableCell = ({ getValue, row, column, table }: { getValue: () => any, row: any, column: any, table: any }) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue?.toString() || '');

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, value);
  };

  useEffect(() => {
    setValue(initialValue?.toString() || '');
  }, [initialValue]);

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      className="w-24"
    />
  );
};

const InfoTable = () => {
  const [data, setData] = useState<RowData[]>(initialData);

  const flattenRows = (rows: RowData[], depth = 0): RowData[] => {
    return rows.flatMap((row) => {
      const flatRow = { ...row, depth };
      return [
        flatRow,
        ...(row.children ? flattenRows(row.children, depth + 1) : []),
      ];
    });
  };

  const calculateVariance = (current: number, original: number) => {
    return ((current - original) / original) * 100;
  };

  const updateParentValues = (rows: RowData[]): RowData[] => {
    return rows.map(row => {
      if (row.children) {
        const updatedChildren = updateParentValues(row.children);
        const newValue = updatedChildren.reduce((sum, child) => sum + child.value, 0);
        return {
          ...row,
          children: updatedChildren,
          value: newValue,
          variance: calculateVariance(newValue, row.originalValue || 0),
        };
      }
      return row;
    });
  };

  const distributeToChildren = (row: RowData, newValue: number): RowData => {
    if (!row.children) return row;

    const totalChildrenValue = row.children.reduce((sum, child) => sum + child.value, 0);
    const ratio = newValue / totalChildrenValue;

    return {
      ...row,
      value: newValue,
      variance: calculateVariance(newValue, row.originalValue || 0),
      children: row.children.map(child => ({
        ...child,
        value: Math.round(child.value * ratio * 100) / 100,
        variance: calculateVariance(Math.round(child.value * ratio * 100) / 100, child.originalValue || 0),
      })),
    };
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'label',
        header: 'Label',
        cell: ({ row }: { row: any }) => (
          <div style={{ paddingLeft: `${row.original.depth * 20}px` }}>
            {row.original.children ? '▶ ' : ''}{row.original.label}
          </div>
        ),
      },
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ row }: { row: any }) => row.original.value.toFixed(2),
      },
      {
        id: 'input',
        header: 'Input',
        cell: EditableCell,
      },
      {
        id: 'allocationPercent',
        header: 'Allocation %',
        cell: ({ row, table }: { row: any, table: any }) => (
          <Button
            onClick={() => {
              const inputValue = row.original._inputValue;
              if (inputValue) {
                const value = parseFloat(inputValue);
                if (!isNaN(value)) {
                  table.options.meta?.updateRowWithPercent(row.index, value);
                }
              }
            }}
          >
            Apply %
          </Button>
        ),
      },
      {
        id: 'allocationValue',
        header: 'Allocation Val',
        cell: ({ row, table }) => (
          <Button
            onClick={() => {
              const inputValue = row.original._inputValue;
              if (inputValue) {
                const value = parseFloat(inputValue);
                if (!isNaN(value)) {
                  table.options.meta?.updateRowWithValue(row.index, value);
                }
              }
            }}
          >
            Apply Value
          </Button>
        ),
      },
      {
        accessorKey: 'variance',
        header: 'Variance %',
        cell: ({ row }: { row: any }) => (row.original.variance || 0).toFixed(2) + '%',
      },
    ],
    []
  );

  const flattenedData = useMemo(() => flattenRows(data), [data]);

  const updateRowValue = (rowIndex: number, newValue: number, isPercentage: boolean) => {
    const flatRow = flattenedData[rowIndex];
    const rowId = flatRow.id;
    
    const updateRow = (rows: RowData[]): RowData[] => {
      return rows.map(row => {
        if (row.id === rowId) {
          const calculatedValue = isPercentage
            ? row.value * (1 + newValue / 100)
            : newValue;

          if (row.children) {
            return distributeToChildren(row, calculatedValue);
          }

          return {
            ...row,
            value: calculatedValue,
            variance: calculateVariance(calculatedValue, row.originalValue || 0),
          };
        }
        if (row.children) {
          return {
            ...row,
            children: updateRow(row.children),
          };
        }
        return row;
      });
    };

    const updatedData = updateRow(data);
    setData(updateParentValues(updatedData));
  };

  const table = useReactTable({
    data: flattenedData,
    columns,
    getExpandedRowModel: getExpandedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData: (rowIndex: number, columnId: string, value: any) => {
        setData(old => {
          const newData = JSON.parse(JSON.stringify(flattenRows(old)));
          newData[rowIndex] = {
            ...newData[rowIndex],
            _inputValue: value, 
          };
          
          return updateParentValues(
            old.map((row) => { 
              if (flattenedData[rowIndex].id === row.id) {
                return {
                  ...row,
                  _inputValue: value,
                };
              }
              if (row.children) {
                return {
                  ...row,
                  children: updateChildrenInputValue(row.children, flattenedData[rowIndex].id, value),
                };
              }
              return row;
            })
          );
        });
      },
      updateRowWithPercent: (rowIndex: number, percentValue: number) => {
        updateRowValue(rowIndex, percentValue, true);
      },
      updateRowWithValue: (rowIndex: number, value: number) => {
        updateRowValue(rowIndex, value, false);
      }
    },
  });

  const updateChildrenInputValue = (children: RowData[], targetId: string, value: string): RowData[] => {
    return children.map(child => {
      if (child.id === targetId) {
        return {
          ...child,
          _inputValue: value,
        };
      }
      if (child.children) {
        return {
          ...child,
          children: updateChildrenInputValue(child.children, targetId, value),
        };
      }
      return child;
    });
  };

  const grandTotal = useMemo(() => 
    data.reduce((sum, row) => sum + row.value, 0),
    [data]
  );

  return (
    <div className="rounded-md border mx-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow className="font-bold">
            <TableCell>Grand Total</TableCell>
            <TableCell>{grandTotal.toFixed(2)}</TableCell>
            <TableCell colSpan={4}></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default InfoTable;