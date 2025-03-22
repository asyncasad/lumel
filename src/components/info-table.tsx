"use client";
import React, { useState, useMemo } from 'react';
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
  ExpandedState,
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

const InfoTable = () => {
  const [data, setData] = useState<RowData[]>(initialData);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

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

  const updateRowValue = (rowId: string, newValue: number, isPercentage: boolean) => {
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
        cell: ({ row }: { row: any }) => (
          <Input
            value={inputValues[row.original.id] || ''}
            onChange={(e) => setInputValues({
              ...inputValues,
              [row.original.id]: e.target.value,
            })}
            className="w-24"
          />
        ),
      },
      {
        id: 'allocationPercent',
        header: 'Allocation %',
        cell: ({ row }: { row: any }) => (
          <Button
            onClick={() => {
              const value = parseFloat(inputValues[row.original.id] || '0');
              if (!isNaN(value)) {
                updateRowValue(row.original.id, value, true);
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
        cell: ({ row }) => (
          <Button
            onClick={() => {
              const value = parseFloat(inputValues[row.original.id] || '0');
              if (!isNaN(value)) {
                updateRowValue(row.original.id, value, false);
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
        cell: ({ row }) => (row.original.variance || 0).toFixed(2) + '%',
      },
    ],
    [inputValues]
  );

  const flattenedData = useMemo(() => flattenRows(data), [data]);

  const table = useReactTable({
    data: flattenedData,
    columns,
    state: {
      expanded,
    },
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    getCoreRowModel: getCoreRowModel(),
  });

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