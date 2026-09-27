"use client"
// 传统后台数据表格封装：统一尺寸/分页/空态/操作列约定，减少各列表页重复配置。
import { Table } from "antd"
import type { TableProps } from "antd"
import type { ReactNode } from "react"

/** 统一的「操作」列：右固定、居中、默认宽度 120；render 返回操作按钮组 */
export function actionColumn(
  render: (record: any, index: number) => ReactNode,
  width = 120,
): any {
  return {
    title: "操作",
    key: "action",
    width,
    fixed: "right",
    align: "center",
    render,
  }
}

/** 数据表格：套用传统后台默认观感，分页/空态已预置，可按需覆盖 */
export function DataTable<T extends object>(props: TableProps<T>) {
  return (
    <Table<T>
      size="small"
      rowKey="id"
      scroll={{ x: "max-content" }}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (t) => `共 ${t} 条`,
        ...(props.pagination || {}),
      }}
      locale={{ emptyText: "暂无数据", ...(props.locale || {}) }}
      {...props}
    />
  )
}
