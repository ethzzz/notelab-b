"use client"
// 传统后台数据表格封装：统一尺寸/分页/空态/操作列约定，减少各列表页重复配置。
import { Table } from "antd"
import type { TableProps } from "antd"
import type { ReactNode } from "react"

/** 统一的「操作」列：右固定、右对齐（对齐 c-users 标杆）、默认宽度 120
 *  render 签名与 antd Column.render 一致：(value, record, index)；操作列通常忽略 value，取 record */
export function actionColumn(
  render: (value: any, record: any, index: number) => ReactNode,
  width = 120,
): any {
  return {
    title: "操作",
    key: "action",
    width,
    fixed: "right",
    align: "right",
    render,
  }
}

/** 数据表格：套用传统后台默认观感，分页/空态已预置，可按需覆盖（pagination={false} 可关闭分页） */
export function DataTable<T extends object>(props: TableProps<T>) {
  const pagination = props.pagination === false
    ? false
    : {
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (t: number) => `共 ${t} 条`,
        ...(props.pagination || {}),
      }
  return (
    <Table<T>
      size="small"
      rowKey="id"
      scroll={{ x: "max-content" }}
      pagination={pagination}
      locale={{ emptyText: "暂无数据", ...(props.locale || {}) }}
      {...props}
    />
  )
}
